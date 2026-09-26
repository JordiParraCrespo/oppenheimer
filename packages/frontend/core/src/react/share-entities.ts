/**
 * TanStack Query's `structuralSharing` for data made of entity classes.
 *
 * The query client's default sharing (`replaceEqualDeep`) keeps an unchanged
 * value's identity across a refetch, but only for plain objects and arrays.
 * Every entity in the frontend packages is a class (`SessionEntity`,
 * `HostEntity`), so by default each refetch or poll hands every reader a new
 * object for every row, and every memo keyed on one misses: a sidebar of
 * sessions re-rendered all of its rows on each two-second provisioning poll,
 * for rows that had not changed.
 *
 * This is the same walk, extended to what the entities are made of: a class
 * instance is compared field by field when both sides share a prototype, and a
 * `Date` by its time. What is equal keeps the previous reference; what changed
 * is the new value, with its unchanged parts still shared — so a list where one
 * session moved on hands back the same objects for every other row.
 *
 * It only walks records. A `Map`, a `Set`, a typed array or a `Blob` holds its
 * contents where an own-key walk cannot see them, so two different ones would
 * compare equal; those are always taken as changed. Opt in per query, on data
 * that is entities, not as the client's default.
 *
 * ```ts
 * useQuery({ queryKey, queryFn, structuralSharing: shareEntities });
 * ```
 */
export function shareEntities<T>(previous: unknown, next: T): T {
  return share(previous, next) as T;
}

function share(previous: unknown, next: unknown): unknown {
  if (Object.is(previous, next)) return previous;

  if (previous instanceof Date && next instanceof Date) {
    return previous.getTime() === next.getTime() ? previous : next;
  }

  if (Array.isArray(previous) && Array.isArray(next)) {
    let same = previous.length === next.length;
    const shared = next.map((item, index) => {
      const kept = share(previous[index], item);
      if (kept !== previous[index]) same = false;
      return kept;
    });
    return same ? previous : shared;
  }

  if (!isRecord(previous) || !isRecord(next)) return next;
  if (Object.getPrototypeOf(previous) !== Object.getPrototypeOf(next)) return next;

  const keys = Object.keys(next);
  if (keys.length !== Object.keys(previous).length) return next;

  let same = true;
  for (const key of keys) {
    if (!Object.hasOwn(previous, key)) return next;
    if (share(previous[key], next[key]) !== previous[key]) same = false;
  }
  // A class instance is not rebuilt from shared parts: it is either the old one
  // or the new one. Its unchanged rows still keep their identity one level up.
  return same ? previous : next;
}

/** An object whose own enumerable fields are its whole state. */
function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  if (value instanceof Map || value instanceof Set || value instanceof WeakMap) return false;
  if (value instanceof WeakSet || value instanceof RegExp || value instanceof Date) return false;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return false;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return false;
  return true;
}
