import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import type { HostExecOutcome, HostExecPort } from '../../application/host-exec.port';
import { HOST_EXEC } from '../../sessions.di-tokens';
import { RunHostCommandCommand } from './run-host-command.command';

/**
 * A bot's command on a host (`product/versions/mvp/25-bots.md` §4.2). The host
 * is checked with the same check a session's create makes, so a bot reaches
 * only the hosts its owner may start work on, and a host they cannot use is the
 * same not-found. What the host then lets run is its own policy: an outcome,
 * not an error, because a refusal is an answer the bot reads and acts on.
 */
@CommandHandler(RunHostCommandCommand)
export class RunHostCommandCommandHandler
  implements ICommandHandler<RunHostCommandCommand, HostExecOutcome>
{
  constructor(
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
    @Inject(HOST_EXEC)
    private readonly exec: HostExecPort,
  ) {}

  async execute(command: RunHostCommandCommand): Promise<HostExecOutcome> {
    await this.hosts.assertUsable(command.scope, command.hostId);
    return this.exec.run(command.hostId, command.request);
  }
}
