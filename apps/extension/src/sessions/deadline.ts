/**
 * How long one request of the worker may take, answer and body. Its requests
 * run one at a time (`serial`), so a read that never answers would hold every
 * later one, replies and chats included, for the worker's life.
 */
export const REQUEST_TIMEOUT_MS = 20_000;

/** A signal that gives up on a request after `ms`, joined to the caller's own when it has one. */
export function deadline(ms = REQUEST_TIMEOUT_MS, signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}
