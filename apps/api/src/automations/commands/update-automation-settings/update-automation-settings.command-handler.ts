import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireOrganization } from '../../../authz/application/tenant-scope.policy';
import { AUTOMATION_SETTINGS_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationSettingsRepositoryPort } from '../../database/automation-settings.repository.port';
import { UpdateAutomationSettingsCommand } from './update-automation-settings.command';

/** The workspace's level of the limits. What it does not send is left as it was. */
@CommandHandler(UpdateAutomationSettingsCommand)
export class UpdateAutomationSettingsCommandHandler
  implements ICommandHandler<UpdateAutomationSettingsCommand, string>
{
  constructor(
    @Inject(AUTOMATION_SETTINGS_REPOSITORY)
    private readonly settings: AutomationSettingsRepositoryPort,
  ) {}

  async execute(command: UpdateAutomationSettingsCommand): Promise<string> {
    const organizationId = command.scope.organizationId;
    requireOrganization(organizationId);
    const current = await this.settings.find(organizationId);
    await this.settings.upsert(organizationId, { ...current, ...command.input });
    return organizationId;
  }
}
