import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { MembershipAccessPolicy } from '../../application/membership-access.policy';
import type { MemberRepositoryPort } from '../../database/member.repository.port';
import type { OrganizationAuthPort } from '../../infrastructure/organization-auth.port';
import { MEMBER_REPOSITORY, ORGANIZATION_AUTH } from '../../organizations.di-tokens';
import { UpdateMemberRoleCommand } from './update-member-role.command';

/**
 * Changes a member's organization role and the application role that stands
 * for it, or neither: if the new application role cannot be granted, the
 * organization role goes back to what it was. Answers the member's id.
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
    const { headers, organizationId, memberId } = command;
    // What to put back. No such member: Better Auth refuses the write below.
    const previous = await this.members.findMembershipById(organizationId, memberId);

    await this.membershipAccess.admit(
      () => this.organizations.updateMemberRole(headers, organizationId, memberId, command.role),
      async () => {
        if (previous.isSome()) {
          const { role } = previous.unwrap();
          await this.organizations.updateMemberRole(headers, organizationId, memberId, role);
        }
      },
    );
    return memberId;
  }
}
