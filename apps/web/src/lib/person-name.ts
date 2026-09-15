/**
 * A user's display name, built from the persisted fields rather than
 * `UserEntity.fullName`.
 *
 * The query cache is persisted to localStorage and rehydrated as plain JSON, so
 * the `fullName` getter is gone on a restored entry — reading it yields
 * `undefined`, and every owner silently loses its name (rendering as
 * "unassigned"). The plain fields survive the round-trip, so the name is
 * assembled from them; an empty name falls back to the email so a row is never
 * blank.
 */
export function personName(user: { firstName: string; lastName: string; email: string }): string {
  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();

  return name || user.email;
}
