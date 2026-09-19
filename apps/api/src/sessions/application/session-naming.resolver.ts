import { Inject, Injectable, Logger } from '@nestjs/common';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import { SESSION_EVENT_KINDS } from '../domain/session-state.policy';
import type { WorkSessionEntity } from '../domain/work-session.entity';
import type { WorkSessionEventEntity } from '../domain/work-session-event.entity';
import type { SessionNamerPort } from '../infrastructure/session-namer.port';
import { SESSION_NAMER, WORK_SESSION_REPOSITORY } from '../sessions.di-tokens';

/**
 * Names a session from the first prompt a batch carried.
 *
 * It takes the **aggregate the caller already holds**, which is the whole point:
 * there is no second command, no second load and no unscoped read — a naming job is
 * not a host, so it has no business on the machine escape hatch — and the append
 * goes through the same path every other write does, which takes the row lock and
 * re-seats the fold, so a runner batch arriving meanwhile cannot be overwritten.
 *
 * Three refusals, each leaving the session its minted slug, which reads fine and
 * costs nothing: no namer configured on this deployment, a name a person typed (a
 * model never overwrites one, which the fold enforces as well), or nothing to say.
 *
 * Nothing here throws. A title is not worth failing a runner's acknowledgement
 * over, which is also why the caller does not await it.
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

  async nameFromPrompt(
    session: WorkSessionEntity,
    appended: readonly WorkSessionEventEntity[],
  ): Promise<void> {
    try {
      if (!this.namer.isConfigured() || session.nameSource === 'user') return;
      const prompt = appended.find((event) => event.kind === SESSION_EVENT_KINDS.PROMPT_FIRST);
      const text = prompt ? promptTextOf(prompt.payload) : null;
      if (!prompt || !text) return;

      const name = await this.namer.nameFor(text);
      if (!name) return;

      await this.sessions.appendEvents(session, [
        {
          // Keyed on the prompt that caused it, so a replayed batch names the
          // session once however many times the runner resends it.
          idempotencyKey: `${SESSION_EVENT_KINDS.NAMED}:${prompt.idempotencyKey}`,
          source: 'api',
          kind: SESSION_EVENT_KINDS.NAMED,
          payload: { name, source: 'model' },
        },
      ]);
    } catch (error) {
      this.logger.warn(`Naming session ${session.slug} failed: ${(error as Error).message}`);
    }
  }
}

/** The prompt the runner reported, narrowed once so nothing downstream casts. */
function promptTextOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const text = (payload as { text?: unknown }).text;
  return typeof text === 'string' && text.trim() ? text : null;
}
