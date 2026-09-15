type Primitive = string | number | boolean | null | undefined;

/** Every dotted path into `T`: `"catalog"`, `"catalog.latencyMs"`, … Arrays are leaves. */
export type ConfigPath<T> = T extends Primitive | readonly unknown[]
  ? never
  : {
      [K in keyof T & string]: T[K] extends Primitive | readonly unknown[]
        ? K
        : K | `${K}.${ConfigPath<T[K]>}`;
    }[keyof T & string];

/** The type found at a dotted path. */
export type ConfigPathValue<T, P extends string> = P extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? ConfigPathValue<T[Head], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

/**
 * Reads a dotted path out of an object. Returns references into `source` rather
 * than copies, which keeps `useSyncExternalStore` snapshots identity-stable.
 */
export function getAttribute<T, P extends ConfigPath<T>>(
  source: T,
  path: P,
): ConfigPathValue<T, P> {
  let current: unknown = source;

  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') {
      return undefined as ConfigPathValue<T, P>;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current as ConfigPathValue<T, P>;
}
