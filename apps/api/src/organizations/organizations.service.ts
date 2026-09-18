import type { IncomingHttpHeaders } from 'node:http';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  AddMemberDto,
  CreateOrganizationDto,
  ListMembersDto,
  UpdateOrganizationDto,
} from '@oppenheimer/shared';
import { APIError } from 'better-auth/api';
import { In, Repository } from 'typeorm';
import { auth } from '../auth/auth';
import { betterAuthHeaders, unwrap, unwrapArray } from '../auth/better-auth.util';
import { Session } from '../auth/entities/session.entity';
import { AccessGrantOrmEntity } from '../authz/database/access-grant.orm-entity';
import { RoleOrmEntity } from '../roles/database/role.orm-entity';
import type { RoleRepositoryPort } from '../roles/database/role.repository.port';
import { UserRoleOrmEntity } from '../roles/database/user-role.orm-entity';
import type { UserRoleRepositoryPort } from '../roles/database/user-role.repository.port';
import { missingSystemRole } from '../roles/missing-system-role';
import { ROLE_REPOSITORY, USER_ROLE_REPOSITORY } from '../roles/roles.di-tokens';
import { UserOrmEntity } from '../users/database/user.orm-entity';
import { MemberOrmEntity } from './database/member.orm-entity';
import { OrganizationSlug } from './domain/value-objects/organization-slug.value-object';
import type {
  FullOrganizationResponseDto,
  MemberResponseDto,
  MemberUserResponseDto,
  OrganizationResponseDto,
  SlugAvailabilityResponseDto,
} from './dtos/organization.response.dto';
import {
  type AssignedRole,
  mapAssignedRolesByUser,
  mapFullOrganization,
  mapMember,
  mapMembers,
  mapOrganization,
  mapOrganizations,
  mapWorkspace,
} from './organization.mappers';
import { invokeOrganizationApi } from './organization-error.mapper';

/**
 * The workspace every new organization starts with.
 *
 * Named the way the sign-up hook used to name it, so an organization created
 * today is indistinguishable from one provisioned back when that happened
 * behind the account's back.
 */
const DEFAULT_WORKSPACE_NAME = 'General';

/**
 * Delegating façade over the Better Auth organization plugin's server API
 * (`auth.api.*`). Better Auth remains the single source of truth for the
 * organization / member tables and enforces its own owner/admin/member rules;
 * this service adds a typed, Swagger-documented, CASL-guarded REST surface.
 * Response normalization lives in `organization.mappers.ts`.
 */
@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly users: Repository<UserOrmEntity>,
    @InjectRepository(UserRoleOrmEntity)
    private readonly userRoleRecords: Repository<UserRoleOrmEntity>,
    @Inject(ROLE_REPOSITORY)
    private readonly roles: RoleRepositoryPort,
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoles: UserRoleRepositoryPort,
    @InjectRepository(MemberOrmEntity)
    private readonly memberRecords: Repository<MemberOrmEntity>,
    @InjectRepository(Session)
    private readonly sessions: Repository<Session>,
    @InjectRepository(AccessGrantOrmEntity)
    private readonly accessGrants: Repository<AccessGrantOrmEntity>,
  ) {}

  private headers(headers: IncomingHttpHeaders): Headers {
    return betterAuthHeaders(headers);
  }

  /**
   * The slug rule lives on the value object, not here: a workspace someone
   * creates by hand and the personal one sign-up provisions have to agree about
   * what a slug is, and they used to hold two copies of the rule.
   */
  private slugify(base: string): string {
    return OrganizationSlug.derive(base).value;
  }

  // --- Organizations ---

  /**
   * Create an organization, and make it one the creator can actually open.
   *
   * Better Auth writes the organization and an `owner` membership; neither is
   * what the app's routes check. CASL is, and until the org-scoped application
   * role is written the creator owns an organization they have no permission
   * to read — which is exactly how a self-service registration used to land on
   * a dashboard that answered 403 (issue #106). The invitation path has always
   * kept the two halves aligned at the moment membership is created; doing the
   * same here is what makes "you created this workspace" and "you may work in
   * it" one act rather than two mechanisms that disagree.
   *
   * The default workspace comes with it, so a fresh organization is somewhere
   * rows can be filed rather than a tenant with no team in it.
   */
  async create(
    headers: IncomingHttpHeaders,
    dto: CreateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    const requestHeaders = this.headers(headers);
    const result = await invokeOrganizationApi(() =>
      auth.api.createOrganization({
        body: {
          name: dto.name,
          slug: dto.slug ?? this.slugify(dto.name),
          logo: dto.logo,
        },
        headers: requestHeaders,
      }),
    );
    const organization = mapOrganization(result);

    const session = await auth.api.getSession({ headers: requestHeaders });
    const creatorId = session?.user.id;
    // No session means a delegated credential Better Auth resolved on its own;
    // the membership is still correct, and the owner's roles are untouched.
    if (creatorId) {
      try {
        await this.assignApplicationRole(creatorId, organization.id, 'owner');
      } catch (error) {
        // Better Auth has already committed the organization and the `owner`
        // membership, and nothing has granted the creator permission to open
        // it — which is exactly the state this whole change exists to remove.
        // Returning it would hand back an organization that can never be used
        // and, worse, one the app then counts as a workspace: the next reload
        // skips onboarding and lands back on a 403, and a retry leaves a
        // second unopenable organization beside the first. So undo the write
        // and fail, leaving the caller able to try again from a clean state.
        await this.discardUnopenableOrganization(requestHeaders, organization.id);
        throw error;
      }
      await this.provisionDefaultWorkspace(requestHeaders, organization.id, creatorId);
    }

    return organization;
  }

  /**
   * Compensate for an organization whose role assignment did not land.
   *
   * Deleting is safe here and nowhere else in this file: the organization is
   * seconds old, its only member is the caller, nothing has been filed in it,
   * and the response is about to be an error either way. A failure to delete
   * is logged rather than thrown — the caller must still see the original
   * error, not one about the cleanup.
   */
  private async discardUnopenableOrganization(
    headers: Headers,
    organizationId: string,
  ): Promise<void> {
    try {
      await auth.api.deleteOrganization({ body: { organizationId }, headers });
    } catch (error) {
      this.logger.error(
        {
          message: 'Could not discard an organization whose role assignment failed',
          organizationId,
        },
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * The "General" workspace every organization starts with, and its creator's
   * membership of it.
   *
   * Best-effort on purpose: the organization and the role that opens it are the
   * part a caller cannot recover from on their own, and failing the whole
   * request here would leave them owning an organization the response told them
   * did not exist. A missing workspace is visible and fixable from the UI.
   */
  private async provisionDefaultWorkspace(
    headers: Headers,
    organizationId: string,
    creatorId: string,
  ): Promise<void> {
    try {
      const team = await auth.api.createTeam({
        body: { name: DEFAULT_WORKSPACE_NAME, organizationId },
        headers,
      });
      const teamId = mapWorkspace(team).id;
      await auth.api.addTeamMember({
        body: { teamId, userId: creatorId },
        headers,
      });
      await auth.api.setActiveTeam({ body: { teamId }, headers });
    } catch (error) {
      this.logger.warn({
        message: 'Could not provision the default workspace for a new organization',
        organizationId,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async update(
    headers: IncomingHttpHeaders,
    organizationId: string,
    dto: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.updateOrganization({
        body: { data: dto, organizationId },
        headers: this.headers(headers),
      }),
    );
    return mapOrganization(result);
  }

  async delete(
    headers: IncomingHttpHeaders,
    organizationId: string,
  ): Promise<OrganizationResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.deleteOrganization({
        body: { organizationId },
        headers: this.headers(headers),
      }),
    );
    return mapOrganization(result);
  }

  async setActive(
    headers: IncomingHttpHeaders,
    organizationId: string,
  ): Promise<OrganizationResponseDto | null> {
    const result = await invokeOrganizationApi(() =>
      auth.api.setActiveOrganization({
        body: { organizationId },
        headers: this.headers(headers),
      }),
    );
    return result ? mapOrganization(result) : null;
  }

  async list(headers: IncomingHttpHeaders): Promise<OrganizationResponseDto[]> {
    const requestHeaders = this.headers(headers);
    const [result, session] = await Promise.all([
      invokeOrganizationApi(() => auth.api.listOrganizations({ headers: requestHeaders })),
      auth.api.getSession({ headers: requestHeaders }),
    ]);
    const organizations = mapOrganizations(result);
    const activeOrganizationId = session?.session.activeOrganizationId;
    if (!activeOrganizationId) return organizations;

    // Consumers that do not yet render an organization switcher use the first
    // item. Put the session's selected organization there instead of relying
    // on Better Auth's membership creation order (an invited user also owns an
    // automatically provisioned personal organization).
    return [...organizations].sort((left, right) =>
      left.id === activeOrganizationId ? -1 : right.id === activeOrganizationId ? 1 : 0,
    );
  }

  async getFull(
    headers: IncomingHttpHeaders,
    organizationId: string,
  ): Promise<FullOrganizationResponseDto | null> {
    const result = await invokeOrganizationApi(() =>
      auth.api.getFullOrganization({
        query: { organizationId },
        headers: this.headers(headers),
      }),
    );
    return result ? mapFullOrganization(result) : null;
  }

  /** Slug availability — Better Auth throws when a slug is taken; translate that to a boolean. */
  async checkSlug(
    headers: IncomingHttpHeaders,
    slug: string,
  ): Promise<SlugAvailabilityResponseDto> {
    try {
      await auth.api.checkOrganizationSlug({
        body: { slug },
        headers: this.headers(headers),
      });
      return { available: true };
    } catch (err) {
      if (err instanceof APIError) return { available: false };
      throw err;
    }
  }

  // --- Members ---

  /**
   * The organization's members, narrowed the way the team table narrows them.
   *
   * Both the search and the role facet are answered here rather than in the
   * browser. The table pages what it is handed, so a facet applied after the
   * response narrows the page on screen and silently drops every match sitting
   * on a page nobody scrolled to — and a filter that is not in the response is
   * a filter no other client (the CLI, an MCP tool, a CSV export) can ask for.
   */
  async listMembers(
    headers: IncomingHttpHeaders,
    organizationId: string,
    filters: ListMembersDto = {},
  ): Promise<MemberResponseDto[]> {
    const result = await invokeOrganizationApi(() =>
      auth.api.listMembers({
        query: { organizationId },
        headers: this.headers(headers),
      }),
    );
    const members = await this.enrichMembers(mapMembers(unwrapArray(result, 'members')));

    const { search, roleIds } = filters;
    if (!search && !roleIds?.length) return members;

    const assigned = await this.assignedRoles(
      members.map((member) => member.userId),
      organizationId,
    );

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

  /**
   * The roles each of these users holds here, by user id.
   *
   * Both halves are read, and both are used: the *name* is what the search
   * matches — the team table's Role column shows an assigned role in preference
   * to the Better Auth organization role, so a search that ignored these would
   * answer a name the reader is looking at by removing the row it is on — and
   * the *id* is what the role facet picks, because two organizations may name a
   * role the same thing and only the id says which one was chosen.
   *
   * Global assignments (`organizationId IS NULL`) count alongside this
   * organization's, which is the union `user_role` documents as a user's
   * effective set.
   */
  private async assignedRoles(
    userIds: string[],
    organizationId: string,
  ): Promise<Map<string, AssignedRole[]>> {
    if (userIds.length === 0) return new Map();

    const rows = await this.userRoleRecords
      .createQueryBuilder('assignment')
      .innerJoin(RoleOrmEntity, 'role', 'role.id = assignment.roleId')
      .select('assignment.userId', 'userId')
      .addSelect('role.id', 'id')
      .addSelect('role.name', 'name')
      .where('assignment.userId IN (:...userIds)', { userIds })
      .andWhere(
        '(assignment.organizationId = :organizationId OR assignment.organizationId IS NULL)',
        { organizationId },
      )
      .getRawMany();

    return mapAssignedRolesByUser(rows);
  }

  async addMember(
    headers: IncomingHttpHeaders,
    organizationId: string,
    dto: AddMemberDto,
  ): Promise<MemberResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.addMember({
        body: {
          userId: dto.userId,
          role: dto.role,
          organizationId,
          teamId: dto.teamId,
        },
        headers: this.headers(headers),
      }),
    );
    const member = mapMember(result);
    await this.assignApplicationRole(member.userId, member.organizationId, member.role);
    return (await this.enrichMembers([member]))[0];
  }

  async removeMember(
    headers: IncomingHttpHeaders,
    organizationId: string,
    memberIdOrEmail: string,
  ): Promise<MemberResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.removeMember({
        body: { memberIdOrEmail, organizationId },
        headers: this.headers(headers),
      }),
    );
    const member = mapMember(unwrap(result, 'member'));
    await this.revokeOrganizationAccess(member.userId, organizationId);
    return (await this.enrichMembers([member]))[0];
  }

  async updateMemberRole(
    headers: IncomingHttpHeaders,
    organizationId: string,
    memberId: string,
    role: string,
  ): Promise<MemberResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.updateMemberRole({
        body: { memberId, role, organizationId },
        headers: this.headers(headers),
      }),
    );
    const member = mapMember(result);
    await this.assignApplicationRole(member.userId, organizationId, member.role);
    return (await this.enrichMembers([member]))[0];
  }

  async leave(headers: IncomingHttpHeaders, organizationId: string): Promise<MemberResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.leaveOrganization({
        body: { organizationId },
        headers: this.headers(headers),
      }),
    );
    const member = mapMember(result);
    await this.revokeOrganizationAccess(member.userId, organizationId);
    return (await this.enrichMembers([member]))[0];
  }

  async getActiveMember(headers: IncomingHttpHeaders): Promise<MemberResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.getActiveMember({ headers: this.headers(headers) }),
    );
    return (await this.enrichMembers([mapMember(result)]))[0];
  }

  private async enrichMembers(members: MemberResponseDto[]): Promise<MemberResponseDto[]> {
    const users = await this.users.find({
      where: { id: In(members.map((member) => member.userId)) },
    });
    const usersById = new Map(users.map((user) => [user.id, this.toMemberUser(user)]));

    return members.map((member) => ({
      ...member,
      user: usersById.get(member.userId) ?? member.user,
    }));
  }

  /** Keep Better Auth's organization role and the app's scoped RBAC role aligned. */
  private async assignApplicationRole(
    userId: string,
    organizationId: string,
    organizationRole: string,
  ): Promise<void> {
    const roleName = applicationRoleFor(organizationRole);
    const role = await this.roles.findOneByName(roleName, null);
    // The same catalog entry the sign-up path raises. Two writers reaching for
    // the same missing role used to answer two different shapes — a bare
    // `Error` here (a 500 with no code) and a problem document there — which is
    // the slug duplication again, in the failure path.
    if (role.isNone()) throw missingSystemRole(roleName);
    await this.userRoles.setRolesForUser(userId, [role.unwrap().id], organizationId);
  }

  /**
   * Revoke every organization-local access path after Better Auth removes the
   * membership. The role assignment is the authorization boundary; clearing
   * grants and stale session selection prevents the removed person from still
   * appearing or acting inside the organization through secondary tables.
   */
  private async revokeOrganizationAccess(userId: string, organizationId: string): Promise<void> {
    await this.userRoles.setRolesForUser(userId, [], organizationId);
    await this.accessGrants.delete({
      organizationId,
      principalType: 'user',
      principalId: userId,
    });

    const fallback = await this.memberRecords.findOne({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
    await this.sessions.update(
      { userId, activeOrganizationId: organizationId },
      {
        activeOrganizationId: fallback?.organizationId ?? null,
        activeTeamId: null,
      },
    );
  }

  private toMemberUser(user: UserOrmEntity): MemberUserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
    };
  }
}

/**
 * Map Better Auth membership roles onto the application's system roles.
 *
 * `owner`/`admin` on the roster become the tenant-scoped `owner` role, never
 * the global `admin`: that one is `manage all`, and assigned org-scoped it
 * unioned into the caller's ability whenever the organization was active —
 * reaching every non-tenant route, including deleting platform accounts.
 */
function applicationRoleFor(role: string): 'owner' | 'user' {
  return role
    .split(',')
    .map((value) => value.trim())
    .some((value) => value === 'owner' || value === 'admin')
    ? 'owner'
    : 'user';
}

/**
 * Whether a member answers a search, matched the way the reader typed it.
 *
 * Name, email, organization role and the names of any roles assigned to them —
 * every field the team table puts on the row, so that searching for something
 * visible cannot come back empty. The needle is lowercased once and compared
 * with `includes`, which is exactly what the browser-side filter this replaces
 * did, so no search that used to match stops matching.
 */
function matchesMemberSearch(
  member: MemberResponseDto,
  search: string | undefined,
  assignedRoles: string[],
): boolean {
  const needle = search?.trim().toLocaleLowerCase();
  if (!needle) return true;

  return [member.user?.name, member.user?.email, member.role, ...assignedRoles].some((field) =>
    field?.toLocaleLowerCase().includes(needle),
  );
}
