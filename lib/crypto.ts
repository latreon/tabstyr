// Passphrase-based encryption for local backups. Uses the Web Crypto API only —
// no libraries, no network. PBKDF2 (SHA-256) derives an AES-GCM key from the
// user's passphrase; GCM provides authentication so a wrong passphrase or a
// tampered file fails to decrypt rather than returning garbage.

// OWASP 2023 floor for PBKDF2-HMAC-SHA256. The cost is paid once per export/
// restore, so a high count is cheap for the user but multiplies an attacker's
// brute-force cost against a stolen backup file.
const KDF_ITERATIONS = 600_000;
// Accept a range on decrypt so a tampered envelope can neither downgrade the KDF
// (cheap brute force) nor pin the CPU with an absurd count. The floor stays at or
// below any count we've ever written (older backups used 250k) so genuine old
// files still decrypt with their own stored, higher count.
const MIN_ITERATIONS = 200_000;
const MAX_ITERATIONS = 2_000_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
// Base64 length bounds for the 16-byte salt / 12-byte IV — guards against a
// malicious envelope forcing a huge allocation before Web Crypto rejects it.
const MAX_SALT_B64 = 64;
const MAX_IV_B64 = 32;
// Minimum passphrase length, enforced at the crypto layer (not just the UI).
export const MIN_PASSPHRASE = 10;

export interface EncryptedEnvelope {
  app: 'tabstyr';
  enc: 'AES-GCM';
  kdf: 'PBKDF2';
  hash: 'SHA-256';
  iterations: number;
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
}

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

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypt `plaintext` under `passphrase`, returning a JSON envelope string. */
export async function encryptToEnvelope(plaintext: string, passphrase: string): Promise<string> {
  if (!passphrase || passphrase.length < MIN_PASSPHRASE) {
    throw new Error(`Passphrase must be at least ${MIN_PASSPHRASE} characters`);
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, KDF_ITERATIONS);
  // Hold the encoded plaintext in a named buffer so we can zero it after the
  // encrypt completes. (The source `plaintext` string is immutable and can't be
  // wiped — JS strings live until GC — but the byte view is mutable, so we clear
  // the copy we control to shorten the window where it sits in memory.)
  const plainBytes = new TextEncoder().encode(plaintext);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plainBytes as BufferSource,
  );
  plainBytes.fill(0);
  const envelope: EncryptedEnvelope = {
    app: 'tabstyr',
    enc: 'AES-GCM',
    kdf: 'PBKDF2',
    hash: 'SHA-256',
    iterations: KDF_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ct)),
  };
  return JSON.stringify(envelope, null, 2);
}

/** True if `text` parses as one of our encrypted envelopes. */
export function isEncryptedEnvelope(text: string): boolean {
  try {
    const o = JSON.parse(text);
    return o?.enc === 'AES-GCM' && o?.kdf === 'PBKDF2' && typeof o?.ciphertext === 'string';
  } catch {
    return false;
  }
}

/** Decrypt an envelope string with `passphrase`. Throws on a wrong passphrase
 * (GCM authentication failure) or a malformed/tampered envelope. */
export async function decryptFromEnvelope(envelopeText: string, passphrase: string): Promise<string> {
  let env: EncryptedEnvelope;
  try {
    env = JSON.parse(envelopeText);
  } catch {
    throw new Error('Not a valid backup file.');
  }
  if (env?.enc !== 'AES-GCM' || env?.kdf !== 'PBKDF2' || !env.ciphertext) {
    throw new Error('Not an encrypted TabStyr backup.');
  }
  if (typeof env.salt !== 'string' || env.salt.length > MAX_SALT_B64 ||
      typeof env.iv !== 'string' || env.iv.length > MAX_IV_B64) {
    throw new Error('Malformed backup file.');
  }
  // Clamp the file-supplied iteration count: never below MIN (downgrade attack),
  // never above MAX (CPU-exhaustion via a crafted envelope).
  const iterations = Math.min(Math.max(Number(env.iterations) || KDF_ITERATIONS, MIN_ITERATIONS), MAX_ITERATIONS);
  const key = await deriveKey(passphrase, fromBase64(env.salt), iterations);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(env.iv) as BufferSource },
      key,
      fromBase64(env.ciphertext) as BufferSource,
    );
  } catch {
    throw new Error('Wrong passphrase or corrupted file.');
  }
  return new TextDecoder().decode(plain);
}
