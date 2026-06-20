import { describe, expect, test } from 'vitest';
import { encryptToEnvelope, decryptFromEnvelope, isEncryptedEnvelope } from '@/lib/crypto';

describe('crypto (passphrase backup)', () => {
  test('round-trips: decrypt(encrypt(x)) === x', async () => {
    const plain = JSON.stringify({ app: 'tabstyr', hello: 'wörld', n: 42 });
    const env = await encryptToEnvelope(plain, 'correct horse battery');
    expect(await decryptFromEnvelope(env, 'correct horse battery')).toBe(plain);
  });

  test('envelope is recognisable and does not leak plaintext', async () => {
    const env = await encryptToEnvelope('super-secret-token', 'pw12345678');
    expect(isEncryptedEnvelope(env)).toBe(true);
    expect(env).not.toContain('super-secret-token');
    const o = JSON.parse(env);
    expect(o).toMatchObject({ app: 'tabstyr', enc: 'AES-GCM', kdf: 'PBKDF2' });
    expect(typeof o.salt).toBe('string');
    expect(typeof o.iv).toBe('string');
  });

  test('wrong passphrase throws (GCM auth failure)', async () => {
    const env = await encryptToEnvelope('data', 'right-pass');
    await expect(decryptFromEnvelope(env, 'wrong-pass')).rejects.toThrow(/wrong passphrase|corrupted/i);
  });

  test('two encryptions of the same input differ (random salt/iv)', async () => {
    const a = await encryptToEnvelope('x', 'pw12345678');
    const b = await encryptToEnvelope('x', 'pw12345678');
    expect(a).not.toBe(b);
  });

  test('rejects an empty passphrase on encrypt', async () => {
    await expect(encryptToEnvelope('x', '')).rejects.toThrow(/passphrase/i);
  });

  test('rejects a passphrase shorter than the minimum on encrypt', async () => {
    await expect(encryptToEnvelope('x', 'short')).rejects.toThrow(/at least 10/i);
  });

  test('a tampered low iteration count cannot silently decrypt', async () => {
    const plain = 'data';
    const env = await encryptToEnvelope(plain, 'correct horse battery');
    const o = JSON.parse(env);
    o.iterations = 1; // downgrade attempt — clamp must refuse to honour it
    const tampered = JSON.stringify(o);
    await expect(decryptFromEnvelope(tampered, 'correct horse battery')).rejects.toThrow(/wrong passphrase|corrupted/i);
  });

  test('an absurd iteration count is clamped (no hang) and fails closed', async () => {
    const env = await encryptToEnvelope('data', 'correct horse battery');
    const o = JSON.parse(env);
    o.iterations = 1_000_000_000; // would freeze the CPU if honoured verbatim
    await expect(decryptFromEnvelope(JSON.stringify(o), 'correct horse battery')).rejects.toThrow(/wrong passphrase|corrupted/i);
  });

  test('rejects an envelope with an oversized salt/iv', async () => {
    const env = await encryptToEnvelope('data', 'correct horse battery');
    const o = JSON.parse(env);
    o.salt = 'A'.repeat(100);
    await expect(decryptFromEnvelope(JSON.stringify(o), 'correct horse battery')).rejects.toThrow(/malformed/i);
  });

  test('isEncryptedEnvelope is false for plain JSON / garbage', () => {
    expect(isEncryptedEnvelope('{"app":"tabstyr","dailyStats":[]}')).toBe(false);
    expect(isEncryptedEnvelope('not json')).toBe(false);
  });

  test('new envelopes use a strong (OWASP-grade) iteration count', async () => {
    const o = JSON.parse(await encryptToEnvelope('data', 'correct horse battery'));
    expect(o.iterations).toBeGreaterThanOrEqual(600_000);
  });

  test('still decrypts an older backup written with the legacy 250k iteration count', async () => {
    // Backward-compat: a backup exported before the bump stored iterations: 250000.
    // Forge such an envelope with Web Crypto directly and confirm decrypt honours
    // the file's own count (the 200k clamp floor sits below it, so no downgrade).
    const pass = 'correct horse battery';
    const plain = 'legacy-data';
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 250_000, hash: 'SHA-256' },
      baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt'],
    );
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain)));
    const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
    const legacy = JSON.stringify({
      app: 'tabstyr', enc: 'AES-GCM', kdf: 'PBKDF2', hash: 'SHA-256',
      iterations: 250_000, salt: b64(salt), iv: b64(iv), ciphertext: b64(ct),
    });
    expect(await decryptFromEnvelope(legacy, pass)).toBe(plain);
  });
});
