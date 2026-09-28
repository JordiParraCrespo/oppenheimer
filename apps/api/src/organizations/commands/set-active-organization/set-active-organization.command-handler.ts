import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { OrganizationAuthPort } from '../../infrastructure/organization-auth.port';
import { ORGANIZATION_AUTH } from '../../organizations.di-tokens';
import { SetActiveOrganizationCommand } from './set-active-organization.command';

/** Selects the organization the caller's session acts in. */
@CommandHandler(SetActiveOrganizationCommand)
export class SetActiveOrganizationCommandHandler
  implements ICommandHandler<SetActiveOrganizationCommand, AggregateID>
{
  constructor(
    @Inject(ORGANIZATION_AUTH)
    private readonly organizations: OrganizationAuthPort,
  ) {}

  async execute(command: SetActiveOrganizationCommand): Promise<AggregateID> {
    await this.organizations.setActive(command.headers, command.organizationId);
    return command.organizationId;
  }
}
