import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { SessionShareRepositoryPort } from '../../database/session-share.repository.port';
import { SESSION_SHARE_REPOSITORY } from '../../sessions.di-tokens';
import { StopSessionShareCommand } from './stop-session-share.command';

/**
 * Stops sharing a session: the share is deleted, so its address opens
 * nothing again and the next share gets a new one. A terminal already open
 * through it is closed by the relay's next re-check, within a minute. Any
 * member who may update the session may stop it, and stopping a session
 * that is not shared is done already.
 */
@CommandHandler(StopSessionShareCommand)
export class StopSessionShareCommandHandler
  implements ICommandHandler<StopSessionShareCommand, void>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(SESSION_SHARE_REPOSITORY)
    private readonly shares: SessionShareRepositoryPort,
  ) {}

  async execute(command: StopSessionShareCommand): Promise<void> {
    const session = await this.loader.find(command.scope, command.sessionId);
    const found = await this.shares.findOneBySession(session.organizationId, session.id);
    if (found.isSome()) await this.shares.delete(found.unwrap());
  }
}
