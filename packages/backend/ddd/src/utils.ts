/**
 * Deeply converts entity or value-object props into plain data, unpacking
 * every nested value object, inside arrays and plain objects too. Dates stay
 * dates (copied). Used by `Entity.toObject()` and `ValueObject.unpack()`.
 *
 * It walks the props rather than `structuredClone`-ing them: a clone drops
 * the prototype of every class instance, so a nested value object came back
 * as `{ props: … }` with no `unpack` left to call.
 *
 * Value objects are detected structurally (via their `unpack` method) rather
 * than with `instanceof ValueObject` so this module stays free of a circular
 * dependency on `value-object.base`.
 */
export function convertPropsToObject(props: unknown): unknown {
  if (props === null || typeof props !== 'object') return props;
  if (props instanceof Date) return new Date(props.getTime());
  if (hasUnpack(props)) return convertPropsToObject(props.unpack());
  if (Array.isArray(props)) return props.map((item) => convertPropsToObject(item));

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    result[key] = convertPropsToObject(value);
  }
  return result;
}

function hasUnpack(value: object): value is { unpack(): unknown } {
  return typeof (value as { unpack?: unknown }).unpack === 'function';
}
