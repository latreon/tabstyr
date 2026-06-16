import { describe, expect, test } from 'vitest';
import { encryptToEnvelope, decryptFromEnvelope, isEncryptedEnvelope } from '@/lib/crypto';

describe('crypto (passphrase backup)', () => {
  test('round-trips: decrypt(encrypt(x)) === x', async () => {
    const plain = JSON.stringify({ app: 'tabstyr', hello: 'wörld', n: 42 });
    const env = await encryptToEnvelope(plain, 'correct horse battery');
    expect(await decryptFromEnvelope(env, 'correct horse battery')).toBe(plain);
  });

  test('envelope is recognisable and does not leak plaintext', async () => {
    const env = await encryptToEnvelope('super-secret-token', 'pw123456');
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
    const a = await encryptToEnvelope('x', 'pw123456');
    const b = await encryptToEnvelope('x', 'pw123456');
    expect(a).not.toBe(b);
  });

  test('rejects an empty passphrase on encrypt', async () => {
    await expect(encryptToEnvelope('x', '')).rejects.toThrow(/passphrase/i);
  });

  test('isEncryptedEnvelope is false for plain JSON / garbage', () => {
    expect(isEncryptedEnvelope('{"app":"tabstyr","dailyStats":[]}')).toBe(false);
    expect(isEncryptedEnvelope('not json')).toBe(false);
  });
});
