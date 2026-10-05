import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { MemberRepositoryPort } from '../../database/member.repository.port';
import type { Membership } from '../../domain/membership.types';
import { MEMBER_REPOSITORY } from '../../organizations.di-tokens';
import { ListMembersQuery } from './list-members.query';

/**
 * The organization's members, narrowed by search and assigned role. Both are
 * part of the query: a filter the response does not carry is one no other
 * client (CLI, MCP tool, CSV export) can ask for, and one applied to a page on
 * screen drops matches on unscrolled pages.
 *
 * Read from Postgres rather than Better Auth's `listMembers`: the route's
 * guards (`@OrganizationScoped`, `read Member`) admit the caller, and the
 * provider's list would be one more roster copy to narrow by hand.
 */
@QueryHandler(ListMembersQuery)
export class ListMembersQueryHandler implements IQueryHandler<ListMembersQuery, Membership[]> {
  constructor(
    @Inject(MEMBER_REPOSITORY)
    private readonly members: MemberRepositoryPort,
  ) {}

  execute(query: ListMembersQuery): Promise<Membership[]> {
    return this.members.findMembers(query.organizationId, {
      search: query.search,
      roleIds: query.roleIds,
    });
  }
}
