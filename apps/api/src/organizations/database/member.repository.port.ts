import type { Option } from 'oxide.ts';
import type { Membership } from '../domain/membership.types';

/**
 * Reads Better Auth's `member` table. Read-only: memberships are written
 * through Better Auth's API, which owns the table.
 */
export interface MemberRepositoryPort {
  /**
   * `userId`'s membership in `organizationId`, with the account behind it;
   * `None` when they are not a member there.
   */
  findMembership(organizationId: string, userId: string): Promise<Option<Membership>>;
}
