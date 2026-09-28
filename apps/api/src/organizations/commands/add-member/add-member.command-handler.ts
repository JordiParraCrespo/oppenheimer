import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { MembershipAccessPolicy } from '../../application/membership-access.policy';
import type { MemberRepositoryPort } from '../../database/member.repository.port';
import type { MemberResponseDto } from '../../dtos/organization.response.dto';
import type { OrganizationAuthPort } from '../../infrastructure/organization-auth.port';
import { OrganizationMapper } from '../../organization.mapper';
import { MEMBER_REPOSITORY, ORGANIZATION_AUTH } from '../../organizations.di-tokens';
import { AddMemberCommand } from './add-member.command';

/**
 * Adds an existing account to an organization, with the application role its
 * organization role stands for — without it, the new member could not open
 * what they were just added to.
 */
@CommandHandler(AddMemberCommand)
export class AddMemberCommandHandler
  implements ICommandHandler<AddMemberCommand, MemberResponseDto>
{
  constructor(
    @Inject(ORGANIZATION_AUTH)
    private readonly organizations: OrganizationAuthPort,
    @Inject(MEMBER_REPOSITORY)
    private readonly members: MemberRepositoryPort,
    private readonly membershipAccess: MembershipAccessPolicy,
  ) {}

  async execute(command: AddMemberCommand): Promise<MemberResponseDto> {
    const member = await this.organizations.addMember(
      command.headers,
      command.organizationId,
      command.input,
    );
    await this.membershipAccess.grant(member.userId, member.organizationId, member.role);
    const [withAccount] = OrganizationMapper.withAccounts(
      [member],
      await this.members.findAccounts([member.userId]),
    );
    return withAccount;
  }
}
