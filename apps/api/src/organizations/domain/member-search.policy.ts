/** The fields of a member row a search reads. */
export interface SearchableMember {
  role: string;
  user?: { name?: string | null; email?: string | null } | null;
}

/**
 * Whether a member answers a search, matched the way the reader typed it.
 *
 * Name, email, organization role and the names of any roles assigned to them —
 * every field the team table puts on the row, so that searching for something
 * visible cannot come back empty. The needle is lowercased once and compared
 * with `includes`, which is exactly what the browser-side filter this replaced
 * did, so no search that used to match stops matching.
 */
export function matchesMemberSearch(
  member: SearchableMember,
  search: string | undefined,
  assignedRoles: string[],
): boolean {
  const needle = search?.trim().toLocaleLowerCase();
  if (!needle) return true;

  return [member.user?.name, member.user?.email, member.role, ...assignedRoles].some((field) =>
    field?.toLocaleLowerCase().includes(needle),
  );
}
