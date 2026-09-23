import { Inject, Injectable, Logger } from '@nestjs/common';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import { titleFromPrompt } from '../domain/session-name.policy';
import { SESSION_EVENT_KINDS, type SessionNameSource } from '../domain/session-state.policy';
import type { WorkSessionEntity } from '../domain/work-session.entity';
import type { WorkSessionEventEntity } from '../domain/work-session-event.entity';
import type { SessionNamerPort } from '../infrastructure/session-namer.port';
import { SESSION_NAMER, WORK_SESSION_REPOSITORY } from '../sessions.di-tokens';

/** A name for a session, and who chose it. */
export interface SessionNameProposal {
  name: string;
  source: Exclude<SessionNameSource, 'user'>;
}

/**
 * Names a session from its first prompt.
 *
 * **Model first, the prompt's own words if it is not quick.** The namer is asked
 * with a short deadline (`SESSION_NAMER_TIMEOUT_MS`); when it answers in time the
 * title is the model's, and when it does not — no provider, a timeout, a rate
 * limit, an empty answer — the title is the prompt's opening words, which needs
 * no network and names the same prompt the same way every time. Either way a
 * session with a first prompt ends up with a readable name rather than its slug.
 *
 * It is two steps, {@link propose} and {@link record}, so the create path can
 * ask the model *while* it dispatches the session to its host and then write the
 * answer onto the aggregate it already holds. There is no second command, no
 * second load and no unscoped read, and the append goes through the same path
 * every other write does, which takes the row lock and re-seats the fold, so a
 * runner batch arriving meanwhile cannot be overwritten.
 *
 * **Two writers reach it.** The console sends the first task with the create
 * request; the runner reports `prompt.first` when it reads that message out of
 * the agent's own transcript, which is the only path for a prompt typed into the
 * terminal. The two mint their idempotency keys differently, so a key cannot be
 * what stops the second naming the session again. {@link alreadyNamed} is: a
 * session that carries a name from anybody has had its first prompt.
 *
 * Nothing here throws. A title is not worth failing a create or a runner's
 * acknowledgement over.
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

  /**
   * The name this prompt gives the session, or `null` when it already has one
   * or the prompt has nothing to name it by. Resolves within the namer's
   * deadline and never rejects.
   */
  async propose(session: WorkSessionEntity, text: string): Promise<SessionNameProposal | null> {
    if (this.alreadyNamed(session) || !text.trim()) return null;
    try {
      const fromModel = await this.namer.nameFor(text);
      if (fromModel) return { name: fromModel, source: 'model' };
    } catch (error) {
      // The port promises `null` rather than a throw; this is the belt to that.
      this.logger.warn(`The session namer threw: ${(error as Error).message}`);
    }
    const fromPrompt = titleFromPrompt(text);
    return fromPrompt ? { name: fromPrompt, source: 'prompt' } : null;
  }

  /**
   * Writes a proposal onto the session as a `session.named` entry.
   *
   * `promptKey` is whatever keyed the `prompt.first` entry the name came from, so
   * a replayed batch names the session once however many times it is resent.
   */
  async record(
    session: WorkSessionEntity,
    proposal: SessionNameProposal | null,
    promptKey: string,
  ): Promise<void> {
    if (!proposal || this.alreadyNamed(session)) return;
    try {
      await this.sessions.appendEvents(session, [
        {
          idempotencyKey: `${SESSION_EVENT_KINDS.NAMED}:${promptKey}`,
          source: 'api',
          kind: SESSION_EVENT_KINDS.NAMED,
          payload: { name: proposal.name, source: proposal.source },
        },
      ]);
    } catch (error) {
      this.logger.warn(`Naming session ${session.slug} failed: ${(error as Error).message}`);
    }
  }

  /** The runner's path: the first prompt it found in a batch it just delivered. */
  async nameFromPrompt(
    session: WorkSessionEntity,
    appended: readonly WorkSessionEventEntity[],
  ): Promise<void> {
    const prompt = appended.find((event) => event.kind === SESSION_EVENT_KINDS.PROMPT_FIRST);
    const text = prompt ? promptTextOf(prompt.payload) : null;
    if (!prompt || !text) return;
    await this.record(session, await this.propose(session, text), prompt.idempotencyKey);
  }

  /**
   * Whether this session already has a name somebody or something chose.
   *
   * A name a person typed is never overwritten — the fold enforces that as well —
   * and a derived name is not re-derived, because it came from this session's
   * first prompt and there is only one of those.
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
