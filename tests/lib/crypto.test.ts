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
});
