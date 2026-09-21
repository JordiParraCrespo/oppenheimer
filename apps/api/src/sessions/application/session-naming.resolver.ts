import { Inject, Injectable, Logger } from '@nestjs/common';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import { SESSION_EVENT_KINDS } from '../domain/session-state.policy';
import type { WorkSessionEntity } from '../domain/work-session.entity';
import type { WorkSessionEventEntity } from '../domain/work-session-event.entity';
import type { SessionNamerPort } from '../infrastructure/session-namer.port';
import { SESSION_NAMER, WORK_SESSION_REPOSITORY } from '../sessions.di-tokens';

/**
 * Names a session from its first prompt.
 *
 * It takes the **aggregate the caller already holds**, which is the whole point:
 * there is no second command, no second load and no unscoped read — a naming job is
 * not a host, so it has no business on the machine escape hatch — and the append
 * goes through the same path every other write does, which takes the row lock and
 * re-seats the fold, so a runner batch arriving meanwhile cannot be overwritten.
 *
 * **Two writers reach it.** The console now sends the first task with the create
 * request, so `CreateSessionCommandHandler` names the session straight away; the
 * runner still reports `prompt.first` when it reads that message out of the
 * agent's own transcript, which is the only path for a prompt typed into the
 * terminal. The two mint their idempotency keys differently — one from a command
 * id, one from a run — so a key cannot be what stops the second naming the
 * session again. {@link alreadyNamed} is: a session that carries a name from
 * anybody has had its first prompt, and the *first* prompt is the one this names
 * it from.
 *
 * The refusals each leave the session its minted slug, which reads fine and costs
 * nothing: no namer configured on this deployment, a name already chosen, or
 * nothing to say.
 *
 * Nothing here throws. A title is not worth failing a runner's acknowledgement
 * over, which is also why neither caller awaits it.
 */
@Injectable()
export class SessionNamingResolver {
  private readonly logger = new Logger(SessionNamingResolver.name);

  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_NAMER)
    private readonly namer: SessionNamerPort,
  ) {}

  /** The runner's path: the first prompt it found in a batch it just delivered. */
  async nameFromPrompt(
    session: WorkSessionEntity,
    appended: readonly WorkSessionEventEntity[],
  ): Promise<void> {
    const prompt = appended.find((event) => event.kind === SESSION_EVENT_KINDS.PROMPT_FIRST);
    const text = prompt ? promptTextOf(prompt.payload) : null;
    if (!prompt || !text) return;
    await this.nameFromText(session, text, prompt.idempotencyKey);
  }

  /**
   * The console's path: the task typed into the composer, which the create
   * request carried.
   *
   * `promptKey` is whatever keyed the `prompt.first` entry this text came from,
   * so the name is keyed on the prompt that caused it and a replayed batch names
   * the session once however many times its writer resends it.
   */
  async nameFromText(session: WorkSessionEntity, text: string, promptKey: string): Promise<void> {
    try {
      if (!this.namer.isConfigured() || this.alreadyNamed(session)) return;

      const name = await this.namer.nameFor(text);
      if (!name) return;

      await this.sessions.appendEvents(session, [
        {
          idempotencyKey: `${SESSION_EVENT_KINDS.NAMED}:${promptKey}`,
          source: 'api',
          kind: SESSION_EVENT_KINDS.NAMED,
          payload: { name, source: 'model' },
        },
      ]);
    } catch (error) {
      this.logger.warn(`Naming session ${session.slug} failed: ${(error as Error).message}`);
    }
  }

  /**
   * Whether this session already has a name somebody or something chose.
   *
   * A name a person typed is never overwritten — the fold enforces that as well —
   * and a name a model already derived is not re-derived, because it came from
   * this session's first prompt and there is only one of those.
   */
  private alreadyNamed(session: WorkSessionEntity): boolean {
    return session.nameSource !== null;
  }
}

/** The prompt the runner reported, narrowed once so nothing downstream casts. */
function promptTextOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const text = (payload as { text?: unknown }).text;
  return typeof text === 'string' && text.trim() ? text : null;
}
