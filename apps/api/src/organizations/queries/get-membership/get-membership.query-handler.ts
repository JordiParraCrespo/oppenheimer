import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { MemberRepositoryPort } from '../../database/member.repository.port';
import type { Membership } from '../../domain/membership.types';
import { OrganizationErrors } from '../../domain/organization.errors';
import { MEMBER_REPOSITORY } from '../../organizations.di-tokens';
import { GetMembershipQuery } from './get-membership.query';

/**
 * The caller's membership in the organization the route names — not Better
 * Auth's `getActiveMember`, which answers for the session's active one. Which
 * error a non-member gets is `product/versions/mvp/08-auth.md`.
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
