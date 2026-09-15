import type { IncomingHttpHeaders } from 'node:http';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { InviteMemberDto } from '@oppenheimer/shared';
import type { Repository } from 'typeorm';
import { auth } from '../auth/auth';
import { betterAuthHeaders, unwrap } from '../auth/better-auth.util';
import type { RoleRepositoryPort } from '../roles/database/role.repository.port';
import type { UserRoleRepositoryPort } from '../roles/database/user-role.repository.port';
import { ROLE_REPOSITORY, USER_ROLE_REPOSITORY } from '../roles/roles.di-tokens';
import { InvitationOrmEntity } from './database/invitation.orm-entity';
import { MemberOrmEntity } from './database/member.orm-entity';
import type { InvitationResponseDto } from './dtos/organization.response.dto';
import { mapInvitation, mapMember, mapPendingInvitations } from './organization.mappers';
import { invokeOrganizationApi } from './organization-error.mapper';

/** Delegating façade over the Better Auth organization plugin's invitation endpoints. */
@Injectable()
export class InvitationsService {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roles: RoleRepositoryPort,
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoles: UserRoleRepositoryPort,
    @InjectRepository(InvitationOrmEntity)
    private readonly invitationRecords: Repository<InvitationOrmEntity>,
    @InjectRepository(MemberOrmEntity)
    private readonly memberRecords: Repository<MemberOrmEntity>,
  ) {}

  private headers(headers: IncomingHttpHeaders): Headers {
    return betterAuthHeaders(headers);
  }

  async invite(
    headers: IncomingHttpHeaders,
    organizationId: string,
    dto: InviteMemberDto,
  ): Promise<InvitationResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.createInvitation({
        body: {
          email: dto.email,
          role: dto.role,
          organizationId,
          teamId: dto.teamId,
        },
        headers: this.headers(headers),
      }),
    );
    return mapInvitation(result);
  }

  async accept(headers: IncomingHttpHeaders, invitationId: string): Promise<InvitationResponseDto> {
    const requestHeaders = this.headers(headers);
    const accepted = await this.acceptedInvitationForCaller(requestHeaders, invitationId);
    if (accepted) {
      await invokeOrganizationApi(() =>
        auth.api.setActiveOrganization({
          body: { organizationId: accepted.invitation.organizationId },
          headers: requestHeaders,
        }),
      );
      await this.assignApplicationRole(accepted.userId, accepted.invitation);
      return accepted.invitation;
    }

    const result = await invokeOrganizationApi(() =>
      auth.api.acceptInvitation({
        body: { invitationId },
        headers: requestHeaders,
      }),
    );
    const invitation = mapInvitation(unwrap(result, 'invitation'));
    const member = mapMember(unwrap(result, 'member'));

    await this.assignApplicationRole(member.userId, invitation);
    return invitation;
  }

  /**
   * Recover a retry after Better Auth committed membership but a later client
   * request failed. Recipient email plus the created membership prove the
   * caller is replaying their own accepted invitation, not claiming another's.
   */
  private async acceptedInvitationForCaller(
    headers: Headers,
    invitationId: string,
  ): Promise<{ invitation: InvitationResponseDto; userId: string } | null> {
    const invitation = await this.invitationRecords.findOne({ where: { id: invitationId } });
    if (invitation?.status !== 'accepted') return null;

    const session = await auth.api.getSession({ headers });
    if (!session || invitation.email.toLowerCase() !== session.user.email.toLowerCase())
      return null;

    const isMember = await this.memberRecords.exists({
      where: { organizationId: invitation.organizationId, userId: session.user.id },
    });
    if (!isMember) return null;

    return { invitation: mapInvitation(invitation), userId: session.user.id };
  }

  private async assignApplicationRole(
    userId: string,
    invitation: InvitationResponseDto,
  ): Promise<void> {
    // Better Auth owns membership roles; CASL owns application permissions.
    // Keep both halves aligned at the moment membership is created, scoped to
    // this organization so an org admin never becomes a platform-wide admin.
    const applicationRole = applicationRoleFor(invitation.role ?? 'member');
    const role = await this.roles.findOneByName(applicationRole, null);
    if (role.isNone()) {
      throw new Error(`Required system role "${applicationRole}" is missing`);
    }
    await this.userRoles.setRolesForUser(userId, [role.unwrap().id], invitation.organizationId);
  }

  async reject(headers: IncomingHttpHeaders, invitationId: string): Promise<InvitationResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.rejectInvitation({
        body: { invitationId },
        headers: this.headers(headers),
      }),
    );
    return mapInvitation(unwrap(result, 'invitation'));
  }

  async cancel(headers: IncomingHttpHeaders, invitationId: string): Promise<InvitationResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.cancelInvitation({
        body: { invitationId },
        headers: this.headers(headers),
      }),
    );
    return mapInvitation(result);
  }

  async get(headers: IncomingHttpHeaders, invitationId: string): Promise<InvitationResponseDto> {
    const result = await invokeOrganizationApi(() =>
      auth.api.getInvitation({
        query: { id: invitationId },
        headers: this.headers(headers),
      }),
    );
    return mapInvitation(result);
  }

  async listForOrganization(
    headers: IncomingHttpHeaders,
    organizationId: string,
  ): Promise<InvitationResponseDto[]> {
    const result = await invokeOrganizationApi(() =>
      auth.api.listInvitations({
        query: { organizationId },
        headers: this.headers(headers),
      }),
    );
    return mapPendingInvitations(result);
  }

  async listForCaller(headers: IncomingHttpHeaders): Promise<InvitationResponseDto[]> {
    const result = await invokeOrganizationApi(() =>
      auth.api.listUserInvitations({ headers: this.headers(headers) }),
    );
    return mapPendingInvitations(result);
  }
}

/** Map Better Auth's organization roles onto the application RBAC templates (see `OrganizationsService`). */
function applicationRoleFor(role: string): 'owner' | 'user' {
  const organizationRoles = role.split(',').map((value) => value.trim());
  return organizationRoles.some((value) => value === 'owner' || value === 'admin')
    ? 'owner'
    : 'user';
}
