import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { OrganizationResponseDto } from '../../dtos/organization.response.dto';
import type { OrganizationAuthPort } from '../../infrastructure/organization-auth.port';
import { ORGANIZATION_AUTH } from '../../organizations.di-tokens';
import { SetActiveOrganizationCommand } from './set-active-organization.command';

/** Selects the organization the caller's session acts in. */
@CommandHandler(SetActiveOrganizationCommand)
export class SetActiveOrganizationCommandHandler
  implements ICommandHandler<SetActiveOrganizationCommand, OrganizationResponseDto | null>
{
  constructor(
    @Inject(ORGANIZATION_AUTH)
    private readonly organizations: OrganizationAuthPort,
  ) {}

  execute(command: SetActiveOrganizationCommand): Promise<OrganizationResponseDto | null> {
    return this.organizations.setActive(command.headers, command.organizationId);
  }
}
