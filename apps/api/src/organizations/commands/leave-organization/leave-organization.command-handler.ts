import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { MembershipAccessPolicy } from '../../application/membership-access.policy';
import type { MemberRepositoryPort } from '../../database/member.repository.port';
import type { MemberResponseDto } from '../../dtos/organization.response.dto';
import type { OrganizationAuthPort } from '../../infrastructure/organization-auth.port';
import { OrganizationMapper } from '../../organization.mapper';
import { MEMBER_REPOSITORY, ORGANIZATION_AUTH } from '../../organizations.di-tokens';
import { LeaveOrganizationCommand } from './leave-organization.command';

/**
 * Ends the caller's own membership, and everything it gave them: their roles,
 * grants and a session still acting in the organization. Better Auth refuses
 * the last owner.
 */
@CommandHandler(LeaveOrganizationCommand)
export class LeaveOrganizationCommandHandler
  implements ICommandHandler<LeaveOrganizationCommand, MemberResponseDto>
{
  constructor(
    @Inject(ORGANIZATION_AUTH)
    private readonly organizations: OrganizationAuthPort,
    @Inject(MEMBER_REPOSITORY)
    private readonly members: MemberRepositoryPort,
    private readonly membershipAccess: MembershipAccessPolicy,
  ) {}

  async execute(command: LeaveOrganizationCommand): Promise<MemberResponseDto> {
    const member = await this.organizations.leave(command.headers, command.organizationId);
    await this.membershipAccess.revoke(member.userId, command.organizationId);
    const [withAccount] = OrganizationMapper.withAccounts(
      [member],
      await this.members.findAccounts([member.userId]),
    );
    return withAccount;
  }
}
