import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import type { HostSettingsOutcome, HostSettingsPort } from '../../application/host-settings.port';
import { HOST_SETTINGS } from '../../sessions.di-tokens';
import { SetHostSettingsCommand } from './set-host-settings.command';

/**
 * A bot changing a host's switches for the person. The host is checked with
 * the check a session's create makes, so a bot reaches only the hosts its
 * owner may start work on; what the host answers is an outcome the bot reads.
 */
@CommandHandler(SetHostSettingsCommand)
export class SetHostSettingsCommandHandler
  implements ICommandHandler<SetHostSettingsCommand, HostSettingsOutcome>
{
  constructor(
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
    @Inject(HOST_SETTINGS)
    private readonly settings: HostSettingsPort,
  ) {}

  async execute(command: SetHostSettingsCommand): Promise<HostSettingsOutcome> {
    await this.hosts.assertUsable(command.scope, command.hostId);
    return this.settings.set(command.hostId, command.change);
  }
}
