import type { Option } from 'oxide.ts';
import type { Membership } from '../domain/membership.types';

/**
 * Reads Better Auth's `member` table for the organization's own use cases.
 *
 * Read-only on purpose: memberships are written through Better Auth's API
 * (`auth.api.addMember`, `updateMemberRole`, …), which owns the table. A read
 * that needs no Better Auth session — the caller's own membership in the
 * organization a route names — comes through here rather than as a raw
 * TypeORM query inside the façade. It grows as the façade's reads move into
 * slices.
 */
export interface MemberRepositoryPort {
  /**
   * `userId`'s membership in `organizationId`, with the account behind it;
   * `None` when they are not a member there.
   */
  findMembership(organizationId: string, userId: string): Promise<Option<Membership>>;
}
