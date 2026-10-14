/**
 * Tiny in-memory pub/sub for verification state invalidation.
 *
 * Deliberately NOT redux and NOT persisted. The server owns the stage; this
 * bus only carries "something invalidated it, go re-ask" so the gate can
 * refetch. Nothing here is ever written to localStorage/sessionStorage, which
 * is what makes browser back / deep links / reinstall safe: a cold start always
 * re-reads /api/accounts/me/ and cannot resurrect a stale "verified" flag.
 */
const listeners = new Set();

export const onVerificationInvalidated = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const emitVerificationInvalidated = (reason) => {
  listeners.forEach((fn) => {
    try {
      fn(reason);
    } catch {
      /* a bad listener must not break the request path */
    }
  });
};

export default { onVerificationInvalidated, emitVerificationInvalidated };