/**
 * TanStack Query's `structuralSharing` for data made of entity classes.
 *
 * The default (`replaceEqualDeep`) keeps identity only for plain objects and
 * arrays, and every frontend entity is a class, so without this each refetch
 * hands readers a new object per row and a list re-renders every row on every
 * poll.
 *
 * This extends the same walk: a class instance is compared field by field when
 * both sides share a prototype, a `Date` by its time. What is equal keeps the
 * previous reference, and what changed keeps its unchanged parts shared.
 *
 * It only walks records. A `Map`, `Set`, typed array or `Blob` hides its
 * contents from an own-key walk, so two different ones would compare equal;
 * those are always taken as changed, as the default takes them. `useQuery` and
 * `useQueries` from `./query` apply it to every query they declare.
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
