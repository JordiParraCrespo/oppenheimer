import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { MAX_SHARE_LINKS_PER_SESSION } from '@oppenheimer/shared';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { SessionShareLinkRepositoryPort } from '../../database/session-share-link.repository.port';
import { SessionShareLinkEntity } from '../../domain/session-share-link.entity';
import { SessionErrors } from '../../domain/sessions.errors';
import { SESSION_SHARE_LINK_REPOSITORY } from '../../sessions.di-tokens';
import { CreateShareLinkCommand } from './create-share-link.command';

export interface CreatedShareLink {
  linkId: string;
  /** The secret, which exists only in this answer. */
  token: string;
}

/**
 * Issues a share link on a live session. Sharing is opening a terminal for
 * somebody else, so it asks what opening one asks: the session in the
 * caller's scope and not closed, and its host still the caller's to use. The
 * link then acts as this caller for as long as it lives.
 */
@CommandHandler(CreateShareLinkCommand)
export class CreateShareLinkCommandHandler
  implements ICommandHandler<CreateShareLinkCommand, CreatedShareLink>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
    @Inject(SESSION_SHARE_LINK_REPOSITORY)
    private readonly links: SessionShareLinkRepositoryPort,
  ) {}

  async execute(command: CreateShareLinkCommand): Promise<CreatedShareLink> {
    const session = await this.loader.requireLive(command.scope, command.sessionId);
    await this.hosts.assertUsable(command.scope, session.hostId);

    const now = new Date();
    const { link, token } = SessionShareLinkEntity.issue({
      organizationId: session.organizationId,
      sessionId: session.id,
      createdByUserId: command.userId,
      ...command.link,
      now,
    });
    const outcome = await this.links.insertWithinLimit(link, MAX_SHARE_LINKS_PER_SESSION, now);
    if (outcome === 'limit_reached') {
      throw new AppError(SessionErrors.TOO_MANY_SHARE_LINKS, {
        detail: `A session holds at most ${MAX_SHARE_LINKS_PER_SESSION} live share links; revoke one first`,
      });
    }
    return { linkId: link.id, token };
  }
}
