import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import type { HostBrowserOutcome, HostBrowserPort } from '../../application/host-browser.port';
import { HOST_BROWSER } from '../../sessions.di-tokens';
import { UseHostBrowserCommand } from './use-host-browser.command';

/**
 * A bot's action in its browser on a host (`product/versions/mvp/25-bots.md`
 * §4.2, "Using a browser"). The host is checked with the same check a
 * session's create makes, so a bot reaches only the hosts its owner may
 * start work on. Whether the host then lets bots browse from it is its own
 * setting: an outcome, not an error, because a refusal is an answer the bot
 * reads and passes on.
 */
@CommandHandler(UseHostBrowserCommand)
export class UseHostBrowserCommandHandler
  implements ICommandHandler<UseHostBrowserCommand, HostBrowserOutcome>
{
  constructor(
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
    @Inject(HOST_BROWSER)
    private readonly browsers: HostBrowserPort,
  ) {}

  async execute(command: UseHostBrowserCommand): Promise<HostBrowserOutcome> {
    await this.hosts.assertUsable(command.scope, command.hostId);
    return this.browsers.act(command.hostId, command.request, command.commandId);
  }
}
