import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { MemberRepositoryPort } from '../../database/member.repository.port';
import { matchesMemberSearch } from '../../domain/member-search.policy';
import type { MemberResponseDto } from '../../dtos/organization.response.dto';
import type { OrganizationAuthPort } from '../../infrastructure/organization-auth.port';
import { OrganizationMapper } from '../../organization.mapper';
import { MEMBER_REPOSITORY, ORGANIZATION_AUTH } from '../../organizations.di-tokens';
import { ListMembersQuery } from './list-members.query';

/**
 * The organization's members, narrowed the way the team table narrows them.
 *
 * Both the search and the role facet are answered here rather than in the
 * browser. The table pages what it is handed, so a facet applied after the
 * response narrows the page on screen and silently drops every match sitting
 * on a page nobody scrolled to — and a filter that is not in the response is
 * a filter no other client (the CLI, an MCP tool, a CSV export) can ask for.
 */
@QueryHandler(ListMembersQuery)
export class ListMembersQueryHandler
  implements IQueryHandler<ListMembersQuery, MemberResponseDto[]>
{
  constructor(
    @Inject(ORGANIZATION_AUTH)
    private readonly organizations: OrganizationAuthPort,
    @Inject(MEMBER_REPOSITORY)
    private readonly members: MemberRepositoryPort,
  ) {}

  async execute(query: ListMembersQuery): Promise<MemberResponseDto[]> {
    const roster = await this.organizations.listMembers(query.headers, query.organizationId);
    const userIds = roster.map((member) => member.userId);
    const members = OrganizationMapper.withAccounts(
      roster,
      await this.members.findAccounts(userIds),
    );

    const { search, roleIds } = query;
    if (!search && !roleIds?.length) return members;

    // The name is what the search matches — the team table's Role column shows
    // an assigned role in preference to the organization role — and the id is
    // what the facet picks.
    const assigned = await this.members.findAssignedRoles(userIds, query.organizationId);

    return members.filter((member) => {
      const roles = assigned.get(member.userId) ?? [];
      // Any, not all: a member holding `admin` and `user` belongs under both
      // facets, which is the union `user_role` documents as their effective set.
      if (roleIds?.length && !roles.some((role) => roleIds.includes(role.id))) return false;

      return matchesMemberSearch(
        member,
        search,
        roles.map((role) => role.name),
      );
    });
  }
}
