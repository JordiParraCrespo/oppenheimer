/**
 * The memo slots of every live request, keyed by the request object itself.
 *
 * A `WeakMap` keeps the memo off the request: no Symbol-keyed properties to
 * declare on request interfaces, and the slots go when the request is
 * collected.
 */
const MEMO = new WeakMap<object, Map<symbol, Promise<unknown>>>();

/**
 * Per-request memo: one computation per `key` per `request`, shared by every
 * caller.
 *
 * The **promise** is memoized, not the value, so callers that ask while the
 * first computation is still in flight await the same one rather than each
 * starting their own.
 *
 * A computation that **rejects is evicted**: every caller already awaiting it
 * sees the rejection, and the next caller in the same request computes again.
 * A memo that held on to a failure would turn one transient error into the
 * answer for the rest of the request; recomputing only costs work on a path
 * that is already failing.
 *
 * `key` is a `symbol` so two modules can never collide by picking the same
 * string. Declare it once, beside the code that owns the value.
 */
export function requestMemo<T>(
  request: object,
  key: symbol,
  compute: () => Promise<T>,
): Promise<T> {
  let slots = MEMO.get(request);
  if (!slots) {
    slots = new Map();
    MEMO.set(request, slots);
  }

  const hit = slots.get(key) as Promise<T> | undefined;
  if (hit) return hit;

  const pending = compute();
  slots.set(key, pending);
  pending.catch(() => {
    // Evict only if the slot still holds this attempt.
    if (slots.get(key) === pending) slots.delete(key);
  });
  return pending;
}
