import { browser } from 'wxt/browser';

// Offline Pro-license verification. A token is minted server-side (Netlify
// function, signing with a private key that never leaves the server) after a
// real payment; the extension only ever holds the PUBLIC key and verifies a
// signature locally. This is deliberate: activating Pro must never require
// the extension to phone out just to check its own entitlement — that would
// both add a permanent network dependency and let a third party (or us) learn
// who's a paying customer just from the check itself. ECDSA P-256 (not
// Ed25519) specifically for Web Crypto support on every target browser,
// including Safari.
//
// Token shape: `<base64 JSON payload>.<base64 signature>`. The signature
// covers the base64 PAYLOAD STRING (not the re-serialized JSON) — same
// approach as a JWT's `header.payload` — so there's no re-serialization
// ambiguity between what was signed and what's verified.

const ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIGN_ALGORITHM = { name: 'ECDSA', hash: 'SHA-256' } as const;

// The production public key. Not a secret — publishing it is the point of
// asymmetric signing. Generated once; if it's ever rotated, every
// already-issued license token becomes unverifiable and customers need a
// fresh one.
export const LICENSE_PUBLIC_KEY_SPKI_B64 =
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEXCOZJBOjLCAEXM3KKDANEocC9bv4BCFk6R6LOF6NYP9Xwo6eItflVl3SRY9DbSHwDhN4TGp1CuZ+vLY2qTBmaA==';

// Guards against a pasted-garbage or hostile token before any parsing/crypto
// runs — a real token is well under 1KB.
const MAX_TOKEN_LEN = 4_096;

export interface LicenseClaims {
  customerId: string;
  tier: 'pro';
  issuedAt: number; // ms epoch
  expiresAt: number; // ms epoch
}

export class LicenseError extends Error {}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function isLicenseClaims(v: unknown): v is LicenseClaims {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.customerId === 'string' && r.customerId.length > 0 &&
    r.tier === 'pro' &&
    typeof r.issuedAt === 'number' && Number.isFinite(r.issuedAt) &&
    typeof r.expiresAt === 'number' && Number.isFinite(r.expiresAt) &&
    r.expiresAt > r.issuedAt
  );
}

async function importPublicKey(spkiB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('spki', fromBase64(spkiB64) as BufferSource, ALGORITHM, false, ['verify']);
}

/**
 * Verify a license token against an explicit public key (base64 SPKI).
 * Exported separately from `verifyLicenseToken` purely so tests can exercise
 * the real signature-checking logic with a disposable test keypair, instead
 * of needing the production private key. Throws `LicenseError` with a
 * user-safe message on ANY failure — malformed, tampered, or wrong signature
 * all look identical to a caller (never leak which check failed).
 */
export async function verifyLicenseTokenWithKey(token: string, publicKeySpkiB64: string): Promise<LicenseClaims> {
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LEN) {
    throw new LicenseError('Invalid license key.');
  }
  const parts = token.trim().split('.');
  if (parts.length !== 2) throw new LicenseError('Invalid license key.');
  const [payloadB64, sigB64] = parts;
  let claims: unknown;
  try {
    claims = JSON.parse(new TextDecoder().decode(fromBase64(payloadB64)));
  } catch {
    throw new LicenseError('Invalid license key.');
  }
  if (!isLicenseClaims(claims)) throw new LicenseError('Invalid license key.');
  let verified: boolean;
  try {
    const key = await importPublicKey(publicKeySpkiB64);
    verified = await crypto.subtle.verify(
      SIGN_ALGORITHM,
      key,
      fromBase64(sigB64) as BufferSource,
      new TextEncoder().encode(payloadB64) as BufferSource,
    );
  } catch {
    throw new LicenseError('Invalid license key.');
  }
  if (!verified) throw new LicenseError('Invalid license key.');
  return claims;
}

/** Verify a license token against the bundled production public key. */
export function verifyLicenseToken(token: string): Promise<LicenseClaims> {
  return verifyLicenseTokenWithKey(token, LICENSE_PUBLIC_KEY_SPKI_B64);
}

/** Whether an already-verified claim set is still within its validity window. */
export function isLicenseActive(claims: LicenseClaims, now: number): boolean {
  return claims.tier === 'pro' && now < claims.expiresAt;
}

// storage.local key. A raw token (not just its parsed claims) is stored so it
// can be re-verified from scratch on every read — never trust a previously
// parsed result, in case storage was tampered with directly.
const STORAGE_KEY = 'licenseToken';

/**
 * The currently stored license, re-verified from scratch. Returns null for
 * anything that isn't a currently-valid, unexpired Pro token — absent,
 * corrupted, tampered, or expired all collapse to the same "not Pro" result,
 * since none of them should throw and break a caller that just wants to
 * gate a feature.
 */
// `publicKeySpkiB64` defaults to the production key everywhere it's actually
// used; the parameter exists so tests can exercise the full activate/read
// round-trip with a disposable test keypair instead of the real secret.
export async function getActiveLicense(
  now = Date.now(),
  publicKeySpkiB64 = LICENSE_PUBLIC_KEY_SPKI_B64,
): Promise<LicenseClaims | null> {
  const { [STORAGE_KEY]: token } = await browser.storage.local.get(STORAGE_KEY);
  if (typeof token !== 'string') return null;
  try {
    const claims = await verifyLicenseTokenWithKey(token, publicKeySpkiB64);
    return isLicenseActive(claims, now) ? claims : null;
  } catch {
    return null;
  }
}

/** Verify and store a newly-pasted token. Throws LicenseError if it's invalid — never stores a bad token. */
export async function activateLicense(
  token: string,
  publicKeySpkiB64 = LICENSE_PUBLIC_KEY_SPKI_B64,
): Promise<LicenseClaims> {
  const claims = await verifyLicenseTokenWithKey(token, publicKeySpkiB64);
  await browser.storage.local.set({ [STORAGE_KEY]: token.trim() });
  return claims;
}

export async function clearLicense(): Promise<void> {
  await browser.storage.local.remove(STORAGE_KEY);
}
