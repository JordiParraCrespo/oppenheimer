import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { SessionShareRepositoryPort } from '../../database/session-share.repository.port';
import { SessionErrors } from '../../domain/sessions.errors';
import { SESSION_SHARE_REPOSITORY } from '../../sessions.di-tokens';
import { SetSessionSharePeopleCommand } from './set-session-share-people.command';

/**
 * Sets who a `people` share names and changes nothing else: what they may do
 * and until when stay as they were. Removing someone ends a terminal they
 * have open within a minute, by the relay's re-check. A closed session's
 * share may still be narrowed.
 */
@CommandHandler(SetSessionSharePeopleCommand)
export class SetSessionSharePeopleCommandHandler
  implements ICommandHandler<SetSessionSharePeopleCommand, string>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(SESSION_SHARE_REPOSITORY)
    private readonly shares: SessionShareRepositoryPort,
  ) {}

  async execute(command: SetSessionSharePeopleCommand): Promise<string> {
    const session = await this.loader.find(command.scope, command.sessionId);
    const found = await this.shares.findOneBySession(session.organizationId, session.id);
    if (found.isNone()) throw new AppError(SessionErrors.SHARE_NOT_FOUND);
    const share = found.unwrap();
    share.setPeople(command.people);
    const stored = await this.shares.upsert(share);
    return stored.id;
  }
}
