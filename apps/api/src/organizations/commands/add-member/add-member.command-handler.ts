import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { MembershipAccessPolicy } from '../../application/membership-access.policy';
import type { OrganizationAuthPort } from '../../infrastructure/organization-auth.port';
import { ORGANIZATION_AUTH } from '../../organizations.di-tokens';
import { AddMemberCommand } from './add-member.command';

/**
 * Adds an existing account to an organization with the application role its
 * organization role stands for, or not at all: a member the app would not let
 * open the organization is taken back off the roster. Answers the member's id.
 */
@CommandHandler(AddMemberCommand)
export class AddMemberCommandHandler implements ICommandHandler<AddMemberCommand, AggregateID> {
  constructor(
    @Inject(ORGANIZATION_AUTH)
    private readonly organizations: OrganizationAuthPort,
    private readonly membershipAccess: MembershipAccessPolicy,
  ) {}

  async execute({ headers, organizationId, input }: AddMemberCommand): Promise<AggregateID> {
    const member = await this.membershipAccess.admit(
      () => this.organizations.addMember(headers, organizationId, input),
      (added) => this.organizations.removeMember(headers, organizationId, added.id),
    );
    return member.id;
  }
}
