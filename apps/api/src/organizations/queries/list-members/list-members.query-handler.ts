import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { MemberRepositoryPort } from '../../database/member.repository.port';
import type { Membership } from '../../domain/membership.types';
import { MEMBER_REPOSITORY } from '../../organizations.di-tokens';
import { ListMembersQuery } from './list-members.query';

/**
 * The organization's members, narrowed the way the team table narrows them.
 *
 * The search and the role facet are part of the query, not a pass over the
 * roster afterwards: a filter the response does not carry is one no other
 * client (the CLI, an MCP tool, a CSV export) can ask for, and one applied to
 * a page on screen drops the matches on pages nobody scrolled to.
 *
 * Read from Postgres rather than Better Auth's `listMembers`: the route's
 * guards (`@OrganizationScoped`, `read Member`) are what admit the caller, as
 * they are for `members/me`, and the provider's list would be one more copy of
 * the roster to narrow by hand.
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
