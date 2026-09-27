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
  /** `null` only if the account row is gone while the membership is not. */
  user: MembershipUser | null;
}
