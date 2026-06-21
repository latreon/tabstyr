// Storage-quota detection. IndexedDB surfaces an exhausted disk/quota as a
// DOMException named 'QuotaExceededError' (legacy code 22) — either thrown from
// the failing request or attached to the transaction's abort. Both the idb
// library's `tx.done` rejection and a raw request error land here.
export function isQuotaError(e: unknown): boolean {
  if (e instanceof DOMException) {
    return e.name === 'QuotaExceededError' || e.code === 22;
  }
  // Some engines wrap the original DOMException on a `.target.error` / `.error`.
  const inner = (e as { target?: { error?: unknown }; error?: unknown } | null);
  const nested = inner?.target?.error ?? inner?.error;
  if (nested && nested !== e) return isQuotaError(nested);
  return false;
}
