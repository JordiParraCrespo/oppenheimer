import type { Option } from 'oxide.ts';
import type { Membership, MembershipUser } from '../domain/membership.types';

/** How the members list is narrowed; both parts optional, and both apply. */
export interface MemberFilters {
  /** Matched against name, email, organization role and assigned role names. */
  search?: string;
  /** Keep members holding any of these assigned roles. */
  roleIds?: string[];
}

/**
 * Reads Better Auth's `member` table, joined to the account behind each row.
 * Read-only: memberships are written through Better Auth's API, which owns the
 * table.
 */
export interface MemberRepositoryPort {
  /**
   * `userId`'s membership in `organizationId`, with the account behind it;
   * `None` when they are not a member there.
   */
  findMembership(organizationId: string, userId: string): Promise<Option<Membership>>;

  /** One membership by its id, with the account behind it. */
  findMembershipById(organizationId: string, memberId: string): Promise<Option<Membership>>;

  /**
   * The organization's members, oldest first, narrowed in the query itself —
   * so a filter costs what its matches cost, not a read of the whole roster.
   * Assigned roles count whether granted in this organization or globally
   * (`organizationId IS NULL`), the union `user_role` documents as a user's
   * effective set.
   */
  findMembers(organizationId: string, filters: MemberFilters): Promise<Membership[]>;

  /**
   * The accounts behind these users, as the members list shows them. An id
   * with no account is left out rather than answered with a placeholder.
   */
  findAccounts(userIds: string[]): Promise<MembershipUser[]>;
}
