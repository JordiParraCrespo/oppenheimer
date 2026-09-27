import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { MemberRepositoryPort } from '../../database/member.repository.port';
import type { Membership } from '../../domain/membership.types';
import { OrganizationErrors } from '../../domain/organization.errors';
import { MEMBER_REPOSITORY } from '../../organizations.di-tokens';
import { GetMembershipQuery } from './get-membership.query';

/**
 * Reads the caller's membership row in the organization the route names.
 *
 * Not Better Auth's `getActiveMember`, which answers for the session's
 * *active* organization: a cookie session may have another one selected, and
 * a token's delegated session has one only when the token is pinned to a
 * single organization.
 *
 * A caller who is not a member there has usually been refused already:
 * authorization runs in the organization the route names, where they hold no
 * roles, so `@CheckPolicies({ read Member })` answers `AUTH_002`. `ORG_003` is
 * for the caller whose *global* roles pass that check (a platform admin) but
 * who has no membership of their own to show.
 */
@QueryHandler(GetMembershipQuery)
export class GetMembershipQueryHandler implements IQueryHandler<GetMembershipQuery, Membership> {
  constructor(
    @Inject(MEMBER_REPOSITORY)
    private readonly members: MemberRepositoryPort,
  ) {}

  async execute(query: GetMembershipQuery): Promise<Membership> {
    const membership = await this.members.findMembership(query.organizationId, query.userId);
    if (membership.isNone()) {
      throw new AppError(OrganizationErrors.NOT_A_MEMBER, {
        detail: 'You hold no membership in this organization.',
      });
    }
    return membership.unwrap();
  }
}
