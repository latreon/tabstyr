import { describe, expect, test } from 'vitest';
import { isQuotaError } from '@/lib/db/errors';

describe('isQuotaError', () => {
  test('detects a QuotaExceededError DOMException by name', () => {
    expect(isQuotaError(new DOMException('full', 'QuotaExceededError'))).toBe(true);
  });

  test('detects the legacy code-22 DOMException', () => {
    // Some engines report only the numeric legacy code.
    const e = new DOMException('full');
    Object.defineProperty(e, 'code', { value: 22 });
    expect(isQuotaError(e)).toBe(true);
  });

  test('unwraps a quota error nested on target.error (IDB request event)', () => {
    const evt = { target: { error: new DOMException('full', 'QuotaExceededError') } };
    expect(isQuotaError(evt)).toBe(true);
  });

  test('returns false for unrelated errors', () => {
    expect(isQuotaError(new DOMException('boom', 'AbortError'))).toBe(false);
    expect(isQuotaError(new Error('nope'))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
    expect(isQuotaError(undefined)).toBe(false);
  });
});
