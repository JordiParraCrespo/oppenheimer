/**
 * Recursively converts entity/value-object props to a plain object, unpacking
 * any nested value objects. Used by `Entity.toObject()` and
 * `ValueObject.unpack()`.
 *
 * Value objects are detected structurally (via their `unpack` method) rather
 * than with `instanceof ValueObject` so this module stays free of a circular
 * dependency on `value-object.base`.
 */
export function convertPropsToObject(props: unknown): unknown {
  const propsCopy = structuredClone(props) as Record<string, unknown>;

  for (const prop in propsCopy) {
    if (Array.isArray(propsCopy[prop])) {
      propsCopy[prop] = (propsCopy[prop] as Array<unknown>).map((item) =>
        convertToPlainObject(item),
      );
    }
    propsCopy[prop] = convertToPlainObject(propsCopy[prop]);
  }

  return propsCopy;
}

function convertToPlainObject(item: unknown): unknown {
  if (
    item !== null &&
    typeof item === 'object' &&
    typeof (item as { unpack?: unknown }).unpack === 'function'
  ) {
    return (item as { unpack: () => unknown }).unpack();
  }
  return item;
}
