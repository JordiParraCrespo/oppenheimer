/** The account behind a membership, as the members list shows it. */
export interface MembershipUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  firstName: string;
  lastName: string;
  isActive: boolean;
  emailVerified: boolean;
}

/**
 * One person's membership in one organization: Better Auth's `member` row
 * (whose `role` is the organization role — `owner`, `admin`, `member`) and
 * the account it belongs to. A read model: Better Auth owns and writes the
 * row, so there is no aggregate behind it.
 */
export interface Membership {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  createdAt: Date;
  user: MembershipUser;
}

/**
 * One role a member holds in an organization: the name a search matches, the
 * id a role facet picks — two organizations may name a role the same thing,
 * and only the id says which one was chosen.
 */
export interface AssignedRole {
  id: string;
  name: string;
}
