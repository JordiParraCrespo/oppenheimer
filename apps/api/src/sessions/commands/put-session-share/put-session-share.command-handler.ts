import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { SessionShareRepositoryPort } from '../../database/session-share.repository.port';
import { SessionShareEntity } from '../../domain/session-share.entity';
import { SESSION_SHARE_REPOSITORY } from '../../sessions.di-tokens';
import { PutSessionShareCommand } from './put-session-share.command';

/**
 * Shares a live session, or replaces how it is shared, keeping its address.
 * Sharing is opening a terminal for somebody else, so it asks what opening
 * one asks: the session in the caller's scope and not closed, and its host
 * still the caller's to use. The share then acts as this caller.
 */
@CommandHandler(PutSessionShareCommand)
export class PutSessionShareCommandHandler
  implements ICommandHandler<PutSessionShareCommand, string>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
    @Inject(SESSION_SHARE_REPOSITORY)
    private readonly shares: SessionShareRepositoryPort,
  ) {}

  async execute(command: PutSessionShareCommand): Promise<string> {
    const session = await this.loader.requireLive(command.scope, command.sessionId);
    await this.hosts.assertUsable(command.scope, session.hostId);

    const found = await this.shares.findOneBySession(session.organizationId, session.id);
    let share: SessionShareEntity;
    if (found.isSome()) {
      share = found.unwrap();
      share.reshare(command.userId, command.share);
    } else {
      share = SessionShareEntity.share({
        organizationId: session.organizationId,
        sessionId: session.id,
        sharedByUserId: command.userId,
        settings: command.share,
      });
    }
    const stored = await this.shares.upsert(share);
    return stored.id;
  }
}
