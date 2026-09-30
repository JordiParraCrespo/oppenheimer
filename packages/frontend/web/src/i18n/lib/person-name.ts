/**
 * A user's display name, built from the persisted fields rather than
 * `UserEntity.fullName`: the query cache is rehydrated from localStorage as
 * plain JSON, where the getter is gone and every owner would silently render
 * as "unassigned". An empty name falls back to the email so a row is never
 * blank.
 */
export function personName(user: { firstName: string; lastName: string; email: string }): string {
  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();

  return name || user.email;
}
