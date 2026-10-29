import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { SessionDispatchPort } from '../../application/session-dispatch.port';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { SessionTerminalWatchRepositoryPort } from '../../database/session-terminal-watch.repository.port';
import {
  SESSION_TERMINAL_WATCHES_MAX,
  SessionTerminalWatchEntity,
  terminalWatchPatternProblem,
} from '../../domain/session-terminal-watch.entity';
import { SessionErrors } from '../../domain/sessions.errors';
import { SESSION_DISPATCH, SESSION_TERMINAL_WATCH_REPOSITORY } from '../../sessions.di-tokens';
import {
  WatchSessionTerminalCommand,
  type WatchSessionTerminalResult,
} from './watch-session-terminal.command';

/**
 * A pattern for a live session's runner to watch its screen for
 * (`27-bot-subscriptions.md` §2). The row is the desired state: it is
 * written first, then sent to the host; an offline host gets it with the
 * next hello, and a runner without `session.watch` never does, which the
 * hints say. A pattern RE2 cannot take is `SESSIONS_042`; past
 * `SESSION_TERMINAL_WATCHES_MAX` on one session is `SESSIONS_043`.
 */
@CommandHandler(WatchSessionTerminalCommand)
export class WatchSessionTerminalCommandHandler
  implements ICommandHandler<WatchSessionTerminalCommand, WatchSessionTerminalResult>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(SESSION_TERMINAL_WATCH_REPOSITORY)
    private readonly watches: SessionTerminalWatchRepositoryPort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
  ) {}

  async execute(command: WatchSessionTerminalCommand): Promise<WatchSessionTerminalResult> {
    const session = await this.loader.requireLiveOnHost(command.scope, command.sessionId);
    const problem = terminalWatchPatternProblem(command.pattern);
    if (problem) throw new AppError(SessionErrors.TERMINAL_PATTERN_INVALID, { detail: problem });
    const watch = SessionTerminalWatchEntity.watch({
      organizationId: session.organizationId,
      sessionId: session.id,
      pattern: command.pattern,
    });
    const outcome = await this.watches.insert(watch, SESSION_TERMINAL_WATCHES_MAX);
    if (outcome === 'full') throw new AppError(SessionErrors.TERMINAL_WATCHES_FULL);
    if (outcome === 'missing') throw new AppError(SessionErrors.NOT_FOUND);
    const { hints } = await this.dispatch.watchTerminal(session, {
      watchId: watch.id,
      pattern: watch.pattern,
    });
    return { sessionId: session.id, watchId: watch.id, hints };
  }
}
