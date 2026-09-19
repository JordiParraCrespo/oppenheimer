import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import type { SessionNamerPort } from '../../infrastructure/session-namer.port';
import { SESSION_NAMER, WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { NameSessionCommand } from './name-session.command';

/** How far back in the log to look for the first prompt. It is one of the first entries. */
const PROMPT_SEARCH_LIMIT = 50;

/**
 * Gives a session a title derived from its first prompt.
 *
 * Three refusals, in order, and each one leaves the session with the slug it was
 * minted with — which reads fine on its own and costs nothing:
 *
 *  - no namer is configured, so this deployment names nothing;
 *  - a person has already named the session, and **a model never overwrites that**;
 *  - the namer had nothing to say, or could not be reached.
 *
 * The result is an ordinary entry in the log, marked as the model's, so replaying
 * the log rebuilds the same name and `PATCH /sessions/{id}` can still overwrite it
 * at any time.
 */
@CommandHandler(NameSessionCommand)
export class NameSessionCommandHandler implements ICommandHandler<NameSessionCommand, void> {
  private readonly logger = new Logger(NameSessionCommandHandler.name);

  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_NAMER)
    private readonly namer: SessionNamerPort,
  ) {}

  async execute(command: NameSessionCommand): Promise<void> {
    if (!this.namer.isConfigured()) return;

    const found = await this.sessions.findOneByIdForMachine(command.sessionId);
    if (found.isNone()) return;
    const session = found.unwrap();
    // The one rule this command must never break. It is checked here and again in
    // the fold, because the fold is what a replay goes through.
    if (session.nameSource === 'user') return;

    const page = await this.sessions.findEvents(session.id, undefined, PROMPT_SEARCH_LIMIT);
    const prompt = page.events.find((event) => event.kind === SESSION_EVENT_KINDS.PROMPT_FIRST);
    const text = promptTextOf(prompt?.payload);
    if (!text) return;

    const name = await this.namer.nameFor(text);
    if (!name) return;

    await this.sessions.appendEvents(session, [
      {
        idempotencyKey: WorkSessionEntity.apiIdempotencyKey(command.id, SESSION_EVENT_KINDS.NAMED),
        source: 'api',
        kind: SESSION_EVENT_KINDS.NAMED,
        payload: { name, source: 'model' },
      },
    ]);
    this.logger.log(`Named session ${session.slug}`);
  }
}

/** The prompt the runner reported, narrowed once so nothing downstream casts. */
function promptTextOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const text = (payload as { text?: unknown }).text;
  return typeof text === 'string' && text.trim() ? text : null;
}
