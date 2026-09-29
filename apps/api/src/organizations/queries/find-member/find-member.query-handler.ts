import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { MemberRepositoryPort } from '../../database/member.repository.port';
import type { Membership } from '../../domain/membership.types';
import { OrganizationErrors } from '../../domain/organization.errors';
import { MEMBER_REPOSITORY } from '../../organizations.di-tokens';
import { FindMemberQuery } from './find-member.query';

/**
 * One membership with the account behind it, for a command to answer with.
 */
@QueryHandler(FindMemberQuery)
export class FindMemberQueryHandler implements IQueryHandler<FindMemberQuery, Membership> {
  constructor(
    @Inject(MEMBER_REPOSITORY)
    private readonly members: MemberRepositoryPort,
  ) {}

  async execute(query: FindMemberQuery): Promise<Membership> {
    const found = await this.members.findMembershipById(query.organizationId, query.memberId);
    if (found.isNone()) throw new AppError(OrganizationErrors.MEMBER_NOT_FOUND);
    return found.unwrap();
  }
}
