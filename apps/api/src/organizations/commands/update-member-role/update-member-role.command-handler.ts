import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { MembershipAccessPolicy } from '../../application/membership-access.policy';
import type { MemberRepositoryPort } from '../../database/member.repository.port';
import { OrganizationErrors } from '../../domain/organization.errors';
import type { OrganizationAuthPort } from '../../infrastructure/organization-auth.port';
import { MEMBER_REPOSITORY, ORGANIZATION_AUTH } from '../../organizations.di-tokens';
import { UpdateMemberRoleCommand } from './update-member-role.command';

/**
 * Changes a member's organization role and the application role that stands
 * for it, or neither: if Better Auth refuses the change, the application roles
 * go back to what they were. Answers the member's id.
 */
@CommandHandler(UpdateMemberRoleCommand)
export class UpdateMemberRoleCommandHandler
  implements ICommandHandler<UpdateMemberRoleCommand, AggregateID>
{
  constructor(
    @Inject(ORGANIZATION_AUTH)
    private readonly organizations: OrganizationAuthPort,
    @Inject(MEMBER_REPOSITORY)
    private readonly members: MemberRepositoryPort,
    private readonly membershipAccess: MembershipAccessPolicy,
  ) {}

  async execute(command: UpdateMemberRoleCommand): Promise<AggregateID> {
    const { headers, organizationId, memberId, role } = command;
    // Whose application role this is; the member row names them.
    const found = await this.members.findMembershipById(organizationId, memberId);
    if (found.isNone()) throw new AppError(OrganizationErrors.MEMBER_NOT_FOUND);

    const member = await this.membershipAccess.reassign(
      { userId: found.unwrap().userId, organizationId, role },
      () => this.organizations.updateMemberRole(headers, organizationId, memberId, role),
    );
    return member.id;
  }
}
