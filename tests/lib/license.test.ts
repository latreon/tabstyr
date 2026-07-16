import { beforeEach, describe, expect, test } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import {
  activateLicense,
  clearLicense,
  getActiveLicense,
  isLicenseActive,
  LicenseError,
  verifyLicenseToken,
  verifyLicenseTokenWithKey,
  type LicenseClaims,
} from '@/lib/license';

// Exercises the real ECDSA verification logic against a disposable test
// keypair — never the production key/token, so these tests carry zero risk
// of ever needing (or leaking) the real private key.

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

async function exportPublicKeyB64(key: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', key);
  return toBase64(new Uint8Array(spki));
}

async function signToken(privateKey: CryptoKey, claims: LicenseClaims): Promise<string> {
  const payloadB64 = toBase64(new TextEncoder().encode(JSON.stringify(claims)));
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(payloadB64),
  );
  return `${payloadB64}.${toBase64(new Uint8Array(sig))}`;
}

async function makeKeyPair() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return { ...pair, publicKeyB64: await exportPublicKeyB64(pair.publicKey) };
}

const NOW = 1_800_000_000_000; // fixed reference instant
const VALID_CLAIMS: LicenseClaims = { customerId: 'cus_123', tier: 'pro', issuedAt: NOW - 1000, expiresAt: NOW + 1000 };

describe('verifyLicenseTokenWithKey', () => {
  test('accepts a token signed by the matching key', async () => {
    const { privateKey, publicKeyB64 } = await makeKeyPair();
    const token = await signToken(privateKey, VALID_CLAIMS);
    await expect(verifyLicenseTokenWithKey(token, publicKeyB64)).resolves.toEqual(VALID_CLAIMS);
  });

  test('rejects a token signed by a DIFFERENT key (forged/wrong keypair)', async () => {
    const signer = await makeKeyPair();
    const trusted = await makeKeyPair();
    const token = await signToken(signer.privateKey, VALID_CLAIMS);
    await expect(verifyLicenseTokenWithKey(token, trusted.publicKeyB64)).rejects.toThrow(LicenseError);
  });

  test('rejects a tampered payload (signature no longer matches)', async () => {
    const { privateKey, publicKeyB64 } = await makeKeyPair();
    const token = await signToken(privateKey, VALID_CLAIMS);
    const [, sig] = token.split('.');
    const forgedClaims = { ...VALID_CLAIMS, tier: 'pro', customerId: 'cus_someone_else' };
    const forgedPayload = toBase64(new TextEncoder().encode(JSON.stringify(forgedClaims)));
    await expect(verifyLicenseTokenWithKey(`${forgedPayload}.${sig}`, publicKeyB64)).rejects.toThrow(LicenseError);
  });

  test('rejects malformed input without throwing anything but LicenseError', async () => {
    const { publicKeyB64 } = await makeKeyPair();
    await expect(verifyLicenseTokenWithKey('not-a-token', publicKeyB64)).rejects.toThrow(LicenseError);
    await expect(verifyLicenseTokenWithKey('a.b.c', publicKeyB64)).rejects.toThrow(LicenseError);
    await expect(verifyLicenseTokenWithKey('', publicKeyB64)).rejects.toThrow(LicenseError);
    await expect(verifyLicenseTokenWithKey('x'.repeat(5000), publicKeyB64)).rejects.toThrow(LicenseError);
  });

  test('rejects a well-signed but structurally invalid payload (missing/wrong-typed fields)', async () => {
    const { privateKey, publicKeyB64 } = await makeKeyPair();
    const token = await signToken(privateKey, { customerId: 'x', tier: 'free', issuedAt: 1, expiresAt: 2 } as never);
    await expect(verifyLicenseTokenWithKey(token, publicKeyB64)).rejects.toThrow(LicenseError);
  });

  test('rejects a payload where expiresAt does not exceed issuedAt', async () => {
    const { privateKey, publicKeyB64 } = await makeKeyPair();
    const token = await signToken(privateKey, { customerId: 'x', tier: 'pro', issuedAt: 100, expiresAt: 100 });
    await expect(verifyLicenseTokenWithKey(token, publicKeyB64)).rejects.toThrow(LicenseError);
  });

  test('a still-valid signature on an EXPIRED token verifies fine — expiry is a separate check', async () => {
    const { privateKey, publicKeyB64 } = await makeKeyPair();
    const expired: LicenseClaims = { customerId: 'cus_1', tier: 'pro', issuedAt: NOW - 2000, expiresAt: NOW - 1000 };
    const token = await signToken(privateKey, expired);
    await expect(verifyLicenseTokenWithKey(token, publicKeyB64)).resolves.toEqual(expired);
  });
});

describe('verifyLicenseToken (production public key)', () => {
  test('rejects anything not signed by the real production private key', async () => {
    const { privateKey } = await makeKeyPair();
    const token = await signToken(privateKey, VALID_CLAIMS);
    await expect(verifyLicenseToken(token)).rejects.toThrow(LicenseError);
  });
});

describe('isLicenseActive', () => {
  test('true strictly before expiresAt', () => {
    expect(isLicenseActive(VALID_CLAIMS, VALID_CLAIMS.expiresAt - 1)).toBe(true);
  });
  test('false at or after expiresAt', () => {
    expect(isLicenseActive(VALID_CLAIMS, VALID_CLAIMS.expiresAt)).toBe(false);
    expect(isLicenseActive(VALID_CLAIMS, VALID_CLAIMS.expiresAt + 1)).toBe(false);
  });
});

describe('storage round-trip', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  test('getActiveLicense is null when nothing is stored', async () => {
    expect(await getActiveLicense()).toBeNull();
  });

  test('activateLicense rejects an invalid token and never stores it', async () => {
    await expect(activateLicense('garbage')).rejects.toThrow(LicenseError);
    expect(await getActiveLicense()).toBeNull();
  });

  test('activateLicense with a token from a foreign key is rejected against the PRODUCTION key and not stored', async () => {
    const { privateKey } = await makeKeyPair();
    const token = await signToken(privateKey, VALID_CLAIMS);
    await expect(activateLicense(token)).rejects.toThrow(LicenseError); // no override → checked against the real prod key
    expect(await getActiveLicense()).toBeNull();
  });

  test('activateLicense round-trips a genuinely valid token end to end (test keypair override)', async () => {
    const { privateKey, publicKeyB64 } = await makeKeyPair();
    const token = await signToken(privateKey, VALID_CLAIMS);
    await expect(activateLicense(token, publicKeyB64)).resolves.toEqual(VALID_CLAIMS);
    await expect(getActiveLicense(VALID_CLAIMS.expiresAt - 1, publicKeyB64)).resolves.toEqual(VALID_CLAIMS);
  });

  test('an activated token reads back as inactive once past its expiresAt', async () => {
    const { privateKey, publicKeyB64 } = await makeKeyPair();
    const token = await signToken(privateKey, VALID_CLAIMS);
    await activateLicense(token, publicKeyB64);
    await expect(getActiveLicense(VALID_CLAIMS.expiresAt + 1, publicKeyB64)).resolves.toBeNull();
  });

  test('clearLicense removes a stored token', async () => {
    const { privateKey, publicKeyB64 } = await makeKeyPair();
    const token = await signToken(privateKey, VALID_CLAIMS);
    await activateLicense(token, publicKeyB64);
    await clearLicense();
    expect(await getActiveLicense(Date.now(), publicKeyB64)).toBeNull();
  });

  test('a corrupted/unparseable stored value reads back as null, not thrown', async () => {
    await fakeBrowser.storage.local.set({ licenseToken: 'not-even-parseable-but-must-not-throw' });
    await expect(getActiveLicense()).resolves.toBeNull();
  });
});
