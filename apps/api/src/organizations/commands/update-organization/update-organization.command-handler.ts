import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { OrganizationAuthPort } from '../../infrastructure/organization-auth.port';
import { ORGANIZATION_AUTH } from '../../organizations.di-tokens';
import { UpdateOrganizationCommand } from './update-organization.command';

@CommandHandler(UpdateOrganizationCommand)
export class UpdateOrganizationCommandHandler
  implements ICommandHandler<UpdateOrganizationCommand, AggregateID>
{
  constructor(
    @Inject(ORGANIZATION_AUTH)
    private readonly organizations: OrganizationAuthPort,
  ) {}

  async execute(command: UpdateOrganizationCommand): Promise<AggregateID> {
    await this.organizations.update(command.headers, command.organizationId, command.data);
    return command.organizationId;
  }
}
