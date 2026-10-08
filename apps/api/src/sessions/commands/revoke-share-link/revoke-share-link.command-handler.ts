import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { SessionShareLinkRepositoryPort } from '../../database/session-share-link.repository.port';
import { SessionErrors } from '../../domain/sessions.errors';
import { SESSION_SHARE_LINK_REPOSITORY } from '../../sessions.di-tokens';
import { RevokeShareLinkCommand } from './revoke-share-link.command';

/**
 * Revokes a link: the row is kept, for the list, and nothing opens through it
 * again. A terminal already open through it is closed by the relay's next
 * re-check, within a minute. Any member who may update the session may revoke
 * any of its links, not only their own: a link someone left open is the
 * workspace's to close. A closed session's links may still be revoked.
 */
@CommandHandler(RevokeShareLinkCommand)
export class RevokeShareLinkCommandHandler
  implements ICommandHandler<RevokeShareLinkCommand, string>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(SESSION_SHARE_LINK_REPOSITORY)
    private readonly links: SessionShareLinkRepositoryPort,
  ) {}

  async execute(command: RevokeShareLinkCommand): Promise<string> {
    const session = await this.loader.find(command.scope, command.sessionId);
    const found = await this.links.findOneById(command.linkId);
    const link = found.isSome() ? found.unwrap() : null;
    if (!link || link.sessionId !== session.id || link.organizationId !== session.organizationId) {
      throw new AppError(SessionErrors.SHARE_LINK_NOT_FOUND);
    }
    link.revoke();
    await this.links.save(link);
    return link.id;
  }
}
