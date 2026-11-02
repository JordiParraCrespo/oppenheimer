import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { SessionPromptTyperResolver } from '../../application/session-prompt-typer.resolver';
import type { SessionWakesPort } from '../../application/session-wakes.port';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { SESSION_WAKES, WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { DeliverSessionWakeCommand } from './deliver-session-wake.command';

/** How long a wake waits before it asks a busy agent again. */
export const WAKE_RETRY_MS = 60_000;
/** How many times it asks: a wake an agent has not taken in four hours is dropped. */
export const WAKE_MAX_ATTEMPTS = 240;

/**
 * Types a wake into its session (`product/next-steps/agent-tools.md` §3–4):
 * the line, as a prompt from `{ kind: 'wake' }`, once the agent is at its
 * prompt. An agent at work or waiting on the person is asked again a minute
 * later, for four hours; so is a host that is offline. A session that is no
 * longer open has nobody to wake, and the wake is dropped.
 *
 * No person is behind a wake: the session's own agent asked for it, through
 * its host, so the session is read as the machine reads it.
 */
@CommandHandler(DeliverSessionWakeCommand)
export class DeliverSessionWakeCommandHandler
  implements ICommandHandler<DeliverSessionWakeCommand, void>
{
  private readonly logger = new Logger(DeliverSessionWakeCommandHandler.name);

  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_WAKES)
    private readonly wakes: SessionWakesPort,
    private readonly typer: SessionPromptTyperResolver,
  ) {}

  async execute(command: DeliverSessionWakeCommand): Promise<void> {
    const { wake } = command;
    const found = await this.sessions.findOneByIdForMachine(wake.sessionId);
    if (found.isNone()) return;
    const session = found.unwrap();
    if (session.state !== 'open' || session.stoppedAt) {
      this.logger.log({ message: 'Dropped a wake: the session is not running', ...ids(wake) });
      return;
    }
    const typed = session.inputRefusal
      ? ({ outcome: 'undelivered' } as const)
      : await this.typer.type(session, {
          commandId: `wake-${wake.wakeId}`,
          text: wake.text,
          sender: { kind: 'wake', source: wake.source, wakeId: wake.wakeId },
        });
    if (typed.outcome === 'typed' || typed.outcome === 'claimed-before') return;
    if (wake.attempt + 1 >= WAKE_MAX_ATTEMPTS) {
      this.logger.warn({ message: 'Dropped a wake its agent never took', ...ids(wake) });
      return;
    }
    await this.wakes.schedule(
      { ...wake, attempt: wake.attempt + 1 },
      new Date(Date.now() + WAKE_RETRY_MS),
      command.metadata.correlationId,
    );
  }
}

function ids(wake: { sessionId: string; wakeId: string; source: string; attempt: number }) {
  return {
    sessionId: wake.sessionId,
    wakeId: wake.wakeId,
    source: wake.source,
    attempt: wake.attempt,
  };
}
