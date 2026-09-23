import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmService } from '@oppenheimer/backend-llm';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import {
  cleanModelTitle,
  sessionTitleRequest,
  titleFromPrompt,
} from '../domain/session-name.policy';
import { SESSION_EVENT_KINDS, type SessionNameSource } from '../domain/session-state.policy';
import type { WorkSessionEntity } from '../domain/work-session.entity';
import type { WorkSessionEventEntity } from '../domain/work-session-event.entity';
import { WORK_SESSION_REPOSITORY } from '../sessions.di-tokens';

/** A name for a session, and who chose it. */
export interface SessionNameProposal {
  name: string;
  source: Exclude<SessionNameSource, 'user'>;
}

/**
 * Names a session from its first prompt.
 *
 * **Model first, the prompt's own words if it is not quick.** The deployment's
 * `LlmService` is asked with a short deadline (`SESSION_NAMER_TIMEOUT_MS`); when
 * it answers in time the title is the model's, and when it does not — no
 * provider, a timeout, a rate limit, an empty answer — the title is the prompt's
 * opening words, which needs no network and names the same prompt the same way
 * every time. This is the one place that knows the budget and the one place that
 * decides the fallback.
 *
 * It is two steps, {@link propose} and {@link record}, so the create path can ask
 * the model *while* it dispatches the session and then write the answer onto the
 * aggregate it already holds. The append goes through the repository, which
 * takes the row lock and folds the entry onto that same instance.
 *
 * **Two writers reach it.** The console sends the first task with the create
 * request; the runner reports `prompt.first` off the agent's transcript, which is
 * the only path for a prompt typed into the terminal. {@link alreadyNamed} is what
 * stops the second naming the session again: a session that carries a name from
 * anybody has had its first prompt.
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
    private readonly llm: LlmService,
    private readonly config: ConfigService,
  ) {}

  /**
   * The name this prompt gives the session, or `null` when it already has one or
   * the prompt has nothing to name it by. Resolves within the naming deadline and
   * never rejects.
   */
  async propose(session: WorkSessionEntity, text: string): Promise<SessionNameProposal | null> {
    if (this.alreadyNamed(session) || !text.trim()) return null;

    const model = this.namerModel;
    if (this.llm.isConfigured() && model) {
      try {
        const completion = await this.llm.complete({
          ...sessionTitleRequest(text),
          model,
          timeoutMs: this.namerTimeoutMs,
        });
        const name = cleanModelTitle(completion.text);
        if (name) return { name, source: 'model' };
      } catch (error) {
        this.logger.warn(
          `No model title; naming the session from its prompt: ${(error as Error).message}`,
        );
      }
    }

    const fromPrompt = titleFromPrompt(text);
    return fromPrompt ? { name: fromPrompt, source: 'prompt' } : null;
  }

  /**
   * Writes a proposal onto the session as a `session.named` entry, folding it
   * onto this same instance.
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

  /** `SESSION_NAMER_MODEL`, else the provider's default (`LLM_MODEL`). */
  private get namerModel(): string | undefined {
    return this.config.get<string>('sessions.namerModel') ?? this.llm.defaultModel;
  }

  /** How long a create waits for the model before the prompt's words stand in. */
  private get namerTimeoutMs(): number | undefined {
    return this.config.get<number>('sessions.namerTimeoutMs');
  }

  /**
   * Whether this session already has a name somebody or something chose. A name
   * a person typed is never overwritten — the fold enforces that as well — and a
   * derived name is not re-derived, because there is only one first prompt.
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
