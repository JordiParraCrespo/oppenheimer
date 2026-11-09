import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import type { HostComputerOutcome, HostComputerPort } from '../../application/host-computer.port';
import { HOST_COMPUTER } from '../../sessions.di-tokens';
import { UseHostComputerCommand } from './use-host-computer.command';

/**
 * A bot's action on a host's screen (`product/versions/mvp/25-bots.md` §4.2,
 * "Using a computer"). The host is checked with the same check a session's
 * create makes, so a bot reaches only the hosts its owner may start work on,
 * and a host they cannot use is the same not-found. Whether the host then
 * lets its screen be used is its own setting: an outcome, not an error,
 * because a refusal is an answer the bot reads and passes on.
 */
@CommandHandler(UseHostComputerCommand)
export class UseHostComputerCommandHandler
  implements ICommandHandler<UseHostComputerCommand, HostComputerOutcome>
{
  constructor(
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
    @Inject(HOST_COMPUTER)
    private readonly computers: HostComputerPort,
  ) {}

  async execute(command: UseHostComputerCommand): Promise<HostComputerOutcome> {
    await this.hosts.assertUsable(command.scope, command.hostId);
    return this.computers.act(command.hostId, command.request, command.commandId);
  }
}
