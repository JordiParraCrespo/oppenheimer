import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { MembershipAccessPolicy } from '../../application/membership-access.policy';
import type { MemberRepositoryPort } from '../../database/member.repository.port';
import type { MemberResponseDto } from '../../dtos/organization.response.dto';
import type { OrganizationAuthPort } from '../../infrastructure/organization-auth.port';
import { OrganizationMapper } from '../../organization.mapper';
import { MEMBER_REPOSITORY, ORGANIZATION_AUTH } from '../../organizations.di-tokens';
import { RemoveMemberCommand } from './remove-member.command';

/**
 * Takes someone off an organization's roster, and everything the organization
 * gave them with it: their roles, grants and a session still acting in it.
 *
 * Answers with the membership it ended rather than its id: the row is gone,
 * so no query could read it back.
 */
@CommandHandler(RemoveMemberCommand)
export class RemoveMemberCommandHandler
  implements ICommandHandler<RemoveMemberCommand, MemberResponseDto>
{
  constructor(
    @Inject(ORGANIZATION_AUTH)
    private readonly organizations: OrganizationAuthPort,
    @Inject(MEMBER_REPOSITORY)
    private readonly members: MemberRepositoryPort,
    private readonly membershipAccess: MembershipAccessPolicy,
  ) {}

  async execute(command: RemoveMemberCommand): Promise<MemberResponseDto> {
    const member = await this.organizations.removeMember(
      command.headers,
      command.organizationId,
      command.memberIdOrEmail,
    );
    await this.membershipAccess.revoke(member.userId, command.organizationId);
    const [withAccount] = OrganizationMapper.withAccounts(
      [member],
      await this.members.findAccounts([member.userId]),
    );
    return withAccount;
  }
}
