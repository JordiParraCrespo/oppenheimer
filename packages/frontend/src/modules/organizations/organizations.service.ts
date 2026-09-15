import type { UpdateOrganizationRequest } from '@oppenheimer/api-client';
import type { CreateOrganizationDto, InviteMemberDto, OrganizationRole } from '@oppenheimer/shared';
import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type { OrganizationEntity } from './organization.entity';
import type { MemberFilters, OrganizationsRepository } from './organizations.repository';

@injectable()
export class OrganizationsService {
  constructor(
    @inject(TOKENS.OrganizationsRepository)
    private readonly repository: OrganizationsRepository,
  ) {}

  findAll(): Promise<OrganizationEntity[]> {
    return this.repository.findAll();
  }

  /** Create a workspace and become its owner — the first thing an org-less account does. */
  create(dto: CreateOrganizationDto): Promise<OrganizationEntity> {
    return this.repository.create(dto);
  }

  /** Invitations addressed to the caller, whichever organization sent them. */
  findMyInvitations() {
    return this.repository.findMyInvitations();
  }

  setActive(id: string) {
    return this.repository.setActive(id);
  }

  findMembers(organizationId: string, filters?: MemberFilters) {
    return this.repository.findMembers(organizationId, filters);
  }

  findInvitations(organizationId: string) {
    return this.repository.findInvitations(organizationId);
  }

  invite(organizationId: string, dto: InviteMemberDto) {
    return this.repository.invite(organizationId, dto);
  }

  updateMemberRole(organizationId: string, memberId: string, role: OrganizationRole) {
    return this.repository.updateMemberRole(organizationId, memberId, role);
  }

  removeMember(organizationId: string, memberId: string) {
    return this.repository.removeMember(organizationId, memberId);
  }

  cancelInvitation(invitationId: string) {
    return this.repository.cancelInvitation(invitationId);
  }

  acceptInvitation(invitationId: string) {
    return this.repository.acceptInvitation(invitationId);
  }

  /**
   * Rename an organization or change its mark.
   *
   * Name, slug and logo live on the organization record rather than in
   * organization *settings* — the split mirrors the server's, so the client
   * cannot develop its own idea of where they belong.
   */
  update(id: string, changes: UpdateOrganizationRequest): Promise<OrganizationEntity> {
    return this.repository.update(id, changes);
  }
}
