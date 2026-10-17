import { randomUUID } from 'node:crypto';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { HostUpdateMessage } from '@oppenheimer/shared/protocol';
import type { LinkRegistryPort } from '../../../links/application/link-registry.port';
import { LINK_REGISTRY } from '../../../links/links.di-tokens';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import { HostErrors } from '../../domain/hosts.errors';
import { HOST_REPOSITORY } from '../../hosts.di-tokens';
import { RunnerReleaseConfig } from '../../infrastructure/runner-release.config';
import { UpdateHostRunnerCommand } from './update-host-runner.command';

/**
 * The console's Update runner: ask a connected host to install the newest
 * release on this deployment's channel now, rather than at its next check and
 * quiet moment (`product/versions/mvp/09-runner-install-and-update.md` §5).
 *
 * One `host.update` with no `version`, so the runner is left unpinned, and a
 * host already pinned refuses (`UPD_004`, in its log). Nothing waits for an
 * answer and nothing is written: an updated runner restarts and its next hello
 * carries the new version, which is the only success there is to report.
 */
@CommandHandler(UpdateHostRunnerCommand)
export class UpdateHostRunnerCommandHandler
  implements ICommandHandler<UpdateHostRunnerCommand, void>
{
  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
    private readonly release: RunnerReleaseConfig,
  ) {}

  async execute(command: UpdateHostRunnerCommand): Promise<void> {
    const found = await this.hosts.findOneById(command.scope, command.hostId);
    if (found.isNone() || found.unwrap().isUnpaired) {
      throw new AppError(HostErrors.NOT_FOUND, { detail: `No host with id ${command.hostId}` });
    }

    const message: HostUpdateMessage = {
      type: 'host.update',
      commandId: randomUUID(),
      channel: this.release.channel,
    };
    if (!this.links.find(command.hostId)?.send(message)) {
      throw new AppError(HostErrors.OFFLINE, {
        detail: 'The host is not connected; its runner updates itself the next time it is.',
      });
    }
  }
}
