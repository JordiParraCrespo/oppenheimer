import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { MembershipAccessPolicy } from '../../application/membership-access.policy';
import type { MemberRepositoryPort } from '../../database/member.repository.port';
import type { MemberResponseDto } from '../../dtos/organization.response.dto';
import type { OrganizationAuthPort } from '../../infrastructure/organization-auth.port';
import { OrganizationMapper } from '../../organization.mapper';
import { MEMBER_REPOSITORY, ORGANIZATION_AUTH } from '../../organizations.di-tokens';
import { UpdateMemberRoleCommand } from './update-member-role.command';

/**
 * Changes a member's organization role, and swaps the application role that
 * stands for it; any other role assigned to them in the organization stays.
 */
@CommandHandler(UpdateMemberRoleCommand)
export class UpdateMemberRoleCommandHandler
  implements ICommandHandler<UpdateMemberRoleCommand, MemberResponseDto>
{
  constructor(
    @Inject(ORGANIZATION_AUTH)
    private readonly organizations: OrganizationAuthPort,
    @Inject(MEMBER_REPOSITORY)
    private readonly members: MemberRepositoryPort,
    private readonly membershipAccess: MembershipAccessPolicy,
  ) {}

  async execute(command: UpdateMemberRoleCommand): Promise<MemberResponseDto> {
    const member = await this.organizations.updateMemberRole(
      command.headers,
      command.organizationId,
      command.memberId,
      command.role,
    );
    await this.membershipAccess.grant(member.userId, command.organizationId, member.role);
    const [withAccount] = OrganizationMapper.withAccounts(
      [member],
      await this.members.findAccounts([member.userId]),
    );
    return withAccount;
  }
}
