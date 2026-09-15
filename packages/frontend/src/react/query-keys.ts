/**
 * Prefix a generated hey-api query key with the feature name Oppenheimer persist
 * and invalidation already use (`queryKey[0] === 'users'`).
 */
export function withFeaturePrefix<const T extends readonly unknown[]>(
  feature: string,
  key: T,
): [string, ...T] {
  return [feature, ...key];
}
