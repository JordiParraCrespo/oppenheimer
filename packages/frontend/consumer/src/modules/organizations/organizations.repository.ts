import {
  type InvitationResponseDto,
  InvitationsApi,
  type MemberResponseDto,
  OrganizationInvitationsApi,
  OrganizationMembersApi,
  type OrganizationResponseDto,
  OrganizationsApi,
  type UpdateOrganizationRequest,
} from '@oppenheimer/api-client';
import { AppError, MapApiError } from '@oppenheimer/frontend-core';
import type { CreateOrganizationDto, InviteMemberDto, OrganizationRole } from '@oppenheimer/shared';
import { injectable } from 'inversify';
import {
  OrganizationEntity,
  OrganizationInvitationEntity,
  OrganizationMemberEntity,
} from './organization.entity';
import { OrganizationsErrors } from './organizations.errors';

/**
 * How the team table narrows its member list. Both are answered by the API —
 * the table pages what it is handed, so filtering after the response would
 * narrow the page on screen and leave every other match unfound.
 */
export interface MemberFilters {
  /** Matches name, email, organization role or an assigned role's name. */
  search?: string;
  /** Ids of assigned roles; a member matches when they hold any of them. */
  roleIds?: string[];
}

function toEntity(organization: OrganizationResponseDto): OrganizationEntity {
  return new OrganizationEntity(
    organization.id,
    organization.name,
    organization.slug,
    organization.logo ?? null,
    new Date(organization.createdAt),
  );
}

@injectable()
export class OrganizationsRepository {
  @MapApiError(OrganizationsErrors.FETCH_LIST_FAILED)
  async findAll(): Promise<OrganizationEntity[]> {
    const result = await OrganizationsApi.list();
    // An absent body is a failed read, not an empty collection — returning `[]`
    // here would render "no organizations" over a request that never succeeded.
    if (!result) throw new AppError(OrganizationsErrors.FETCH_LIST_FAILED);

    return result.map(toEntity);
  }

  /**
   * Invitations addressed to the caller, whichever organization sent them.
   *
   * Membership here comes from an invitation, so this is what an account with
   * no workspace yet can act on: the endpoint is answered from the caller's own
   * email address and needs no organization to be active.
   */
  @MapApiError(OrganizationsErrors.FETCH_MY_INVITATIONS_FAILED)
  async findMyInvitations(): Promise<OrganizationInvitationEntity[]> {
    const result = await InvitationsApi.listMine();
    if (!result) throw new AppError(OrganizationsErrors.FETCH_MY_INVITATIONS_FAILED);
    return result.map(toInvitationEntity);
  }

  /**
   * Create an organization and become its owner.
   *
   * Registering creates an account, not a tenancy: this is how a signed-in
   * account with no workspace gets one. The API writes the owner membership,
   * the org-scoped role and a default workspace in the same call, so the
   * creator can open what they just made without a second request.
   */
  @MapApiError(OrganizationsErrors.CREATE_FAILED)
  async create(dto: CreateOrganizationDto): Promise<OrganizationEntity> {
    const result = await OrganizationsApi.create(dto);
    if (!result) throw new AppError(OrganizationsErrors.CREATE_FAILED);
    return toEntity(result);
  }

  @MapApiError(OrganizationsErrors.UPDATE_FAILED)
  async update(id: string, changes: UpdateOrganizationRequest): Promise<OrganizationEntity> {
    const result = await OrganizationsApi.update(id, changes);
    if (!result) throw new AppError(OrganizationsErrors.UPDATE_FAILED);

    return toEntity(result);
  }

  @MapApiError(OrganizationsErrors.SET_ACTIVE_FAILED)
  async setActive(id: string): Promise<OrganizationEntity> {
    const result = await OrganizationsApi.setActive(id);
    if (!result) throw new AppError(OrganizationsErrors.SET_ACTIVE_FAILED);
    return toEntity(result);
  }

  @MapApiError(OrganizationsErrors.FETCH_MEMBERS_FAILED)
  async findMembers(
    organizationId: string,
    filters: MemberFilters = {},
  ): Promise<OrganizationMemberEntity[]> {
    // An empty facet is *no* facet, not "match nothing": sending `roleIds=[]`
    // would ask the server for members holding none of no roles.
    const roleIds = filters.roleIds?.length ? filters.roleIds : undefined;
    const result = await OrganizationMembersApi.list(organizationId, roleIds, filters.search);
    if (!result) throw new AppError(OrganizationsErrors.FETCH_MEMBERS_FAILED);
    return result.map(toMemberEntity);
  }

  @MapApiError(OrganizationsErrors.FETCH_INVITATIONS_FAILED)
  async findInvitations(organizationId: string): Promise<OrganizationInvitationEntity[]> {
    const result = await OrganizationInvitationsApi.list(organizationId);
    if (!result) throw new AppError(OrganizationsErrors.FETCH_INVITATIONS_FAILED);
    return result.map(toInvitationEntity);
  }

  @MapApiError(OrganizationsErrors.INVITE_FAILED)
  async invite(
    organizationId: string,
    dto: InviteMemberDto,
  ): Promise<OrganizationInvitationEntity> {
    const result = await OrganizationInvitationsApi.invite(organizationId, dto);
    if (!result) throw new AppError(OrganizationsErrors.INVITE_FAILED);
    return toInvitationEntity(result);
  }

  @MapApiError(OrganizationsErrors.UPDATE_MEMBER_FAILED)
  async updateMemberRole(
    organizationId: string,
    memberId: string,
    role: OrganizationRole,
  ): Promise<OrganizationMemberEntity> {
    const result = await OrganizationMembersApi.updateRole(organizationId, memberId, { role });
    if (!result) throw new AppError(OrganizationsErrors.UPDATE_MEMBER_FAILED);
    return toMemberEntity(result);
  }

  @MapApiError(OrganizationsErrors.REMOVE_MEMBER_FAILED)
  async removeMember(organizationId: string, memberId: string): Promise<void> {
    await OrganizationMembersApi.remove(organizationId, memberId);
  }

  @MapApiError(OrganizationsErrors.CANCEL_INVITATION_FAILED)
  async cancelInvitation(invitationId: string): Promise<void> {
    await InvitationsApi.cancel(invitationId);
  }

  @MapApiError(OrganizationsErrors.ACCEPT_INVITATION_FAILED)
  async acceptInvitation(invitationId: string): Promise<OrganizationInvitationEntity> {
    const result = await InvitationsApi.accept(invitationId);
    if (!result) throw new AppError(OrganizationsErrors.ACCEPT_INVITATION_FAILED);
    return toInvitationEntity(result);
  }
}

function toMemberEntity(data: MemberResponseDto): OrganizationMemberEntity {
  const fallbackName = data.user?.email.split('@')[0] ?? data.userId;
  return new OrganizationMemberEntity(
    data.id,
    data.organizationId,
    data.userId,
    data.role,
    new Date(data.createdAt),
    data.user?.name || fallbackName,
    data.user?.email ?? '',
    data.user?.image ?? null,
    data.user?.isActive ?? true,
    data.user?.emailVerified ?? false,
  );
}

function toInvitationEntity(data: InvitationResponseDto): OrganizationInvitationEntity {
  return new OrganizationInvitationEntity(
    data.id,
    data.organizationId,
    data.email,
    data.role ?? 'member',
    data.status,
    new Date(data.expiresAt),
    new Date(data.createdAt),
  );
}
