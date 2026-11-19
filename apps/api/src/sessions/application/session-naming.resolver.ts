import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmService } from '@oppenheimer/backend-llm';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import {
  CONVERSATION_RENAME_AFTER_PROMPTS,
  cleanModelTitle,
  conversationTitleRequest,
  promptsOf,
  type SessionTitleRequest,
  sessionTitleRequest,
  titleFromPrompt,
} from '../domain/session-name.policy';
import { SESSION_EVENT_KINDS, type SessionNameSource } from '../domain/session-state.policy';
import { redactEntry } from '../domain/session-transcript.policy';
import type { WorkSessionEntity } from '../domain/work-session.entity';
import type { WorkSessionEventEntity } from '../domain/work-session-event.entity';
import { SessionTranscriptMapper } from '../session-transcript.mapper';
import { SESSION_TRANSCRIPT, WORK_SESSION_REPOSITORY } from '../sessions.di-tokens';
import type { SessionTranscriptPort } from './session-transcript.port';

export interface SessionNameProposal {
  name: string;
  source: Exclude<SessionNameSource, 'user' | 'conversation'>;
}

/**
 * How much of the conversation is read, from its first line, to find the
 * person's prompts: enough entries that a handful of prompts and the tool calls
 * between them fit, well under a page's bound.
 */
const CONVERSATION_READ_ENTRIES = 120;

/**
 * The model's deadline for a conversation's title. Nobody waits on it (it runs
 * after a runner's batch is acknowledged), so it is longer than the create
 * path's `SESSION_NAMER_TIMEOUT_MS`, as its input is.
 */
const CONVERSATION_TIMEOUT_MS = 15_000;

/** The one `session.named` a conversation's title is recorded under, so it is written once. */
const CONVERSATION_NAMED_KEY = `${SESSION_EVENT_KINDS.NAMED}:conversation`;

/**
 * Names a session from its first prompt, then once more from its conversation.
 *
 * **Model first, the prompt's own words if it is not quick.** `LlmService` gets a
 * short deadline (`SESSION_NAMER_TIMEOUT_MS`); on no provider, a timeout, a rate
 * limit or an empty answer the title is `titleFromPrompt`, which needs no network.
 *
 * {@link propose} and {@link record} are separate so the create path can ask the
 * model *while* it dispatches, then write onto the aggregate it holds (the repository
 * takes the row lock and folds the entry onto that instance).
 *
 * **Two writers reach it**: the console's create request, and a runner's
 * `prompt.first` off the transcript (the only path for a prompt typed into the
 * terminal; the runner reads Claude Code's today). {@link alreadyNamed} stops the second
 * renaming: a session named by anybody has had its first prompt.
 *
 * **Once more, when the conversation has gone further.** After the agent answers
 * the person's {@link CONVERSATION_RENAME_AFTER_PROMPTS}th prompt, a model titles
 * the session again from all of their prompts so far ({@link renameFromConversation}),
 * once, and only over a derived title: a name a person typed stays.
 *
 * Nothing here throws: a title is not worth failing a create or an acknowledgement.
 */
@Injectable()
export class SessionNamingResolver {
  private readonly logger = new Logger(SessionNamingResolver.name);

  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_TRANSCRIPT)
    private readonly transcripts: SessionTranscriptPort,
    private readonly llm: LlmService,
    private readonly config: ConfigService,
  ) {}

  /**
   * What a runner's batch owes the name: the first prompt it carried names the
   * session, and an answer the agent finished may rename it from the
   * conversation. One after the other, so a batch with both sees the first name.
   */
  async nameFromBatch(
    session: WorkSessionEntity,
    appended: readonly WorkSessionEventEntity[],
  ): Promise<void> {
    await this.nameFromPrompt(session, appended);
    if (appended.some(finishedAnswer)) await this.renameFromConversation(session);
  }

  /**
   * The name this prompt gives the session, or `null` when it already has one or
   * the prompt has nothing to name it by. Resolves within the naming deadline and
   * never rejects.
   */
  async propose(session: WorkSessionEntity, text: string): Promise<SessionNameProposal | null> {
    if (this.alreadyNamed(session) || !text.trim()) return null;

    const name = await this.askModel(sessionTitleRequest(text), this.namerTimeoutMs, (error) =>
      this.logger.warn(`No model title; naming the session from its prompt: ${error.message}`),
    );
    if (name) return { name, source: 'model' };

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

  /**
   * Titles the session again from the person's prompts so far, once the
   * conversation has {@link CONVERSATION_RENAME_AFTER_PROMPTS} of them, and
   * records it as `conversation`.
   *
   * Only over a title derived from the first prompt: a session a person named,
   * or one already renamed this way, is left alone without reading anything,
   * so the host is asked for the conversation only until the rename lands. It
   * needs a model: the prompt's own words already named the session, and
   * guessing again without one would only churn the name. The write is
   * conditional on the name still being derived when it lands, under the
   * session's lock, so a rename typed while the model was thinking wins.
   */
  async renameFromConversation(session: WorkSessionEntity): Promise<void> {
    if (session.nameSource !== 'model' && session.nameSource !== 'prompt') return;
    if (session.place === 'cloud' || session.hostId === null) return;
    if (!this.llm.isConfigured() || !this.namerModel) return;

    try {
      const outcome = await this.transcripts.read(session.hostId, session.id, {
        limit: CONVERSATION_READ_ENTRIES,
        from: 'start',
      });
      if (outcome.kind !== 'page') return;
      const entries = SessionTranscriptMapper.toEntries(outcome.page.entries).map(
        (entry) => redactEntry(entry).entry,
      );
      const prompts = promptsOf(entries);
      if (prompts.length < CONVERSATION_RENAME_AFTER_PROMPTS) return;

      const name = await this.askModel(
        conversationTitleRequest(prompts),
        CONVERSATION_TIMEOUT_MS,
        (error) => this.logger.warn(`No conversation title for ${session.slug}: ${error.message}`),
      );
      if (!name) return;
      await this.sessions.appendEventsIf(
        session,
        [
          {
            idempotencyKey: CONVERSATION_NAMED_KEY,
            source: 'api',
            kind: SESSION_EVENT_KINDS.NAMED,
            payload: { name, source: 'conversation' },
          },
        ],
        (fold) => fold.nameSource === 'model' || fold.nameSource === 'prompt',
      );
    } catch (error) {
      this.logger.warn(`Renaming session ${session.slug} failed: ${(error as Error).message}`);
    }
  }

  /** The configured model's title for this request, or `null`, never a rejection. */
  private async askModel(
    request: SessionTitleRequest,
    timeoutMs: number | undefined,
    onError: (error: Error) => void,
  ): Promise<string | null> {
    const model = this.namerModel;
    if (!this.llm.isConfigured() || !model) return null;
    try {
      const completion = await this.llm.complete({ ...request, model, timeoutMs });
      return cleanModelTitle(completion.text);
    } catch (error) {
      onError(error as Error);
      return null;
    }
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
   * A name a person typed is never overwritten — the fold enforces that as well — and a
   * derived name is not re-derived, because there is only one first prompt.
   */
  private alreadyNamed(session: WorkSessionEntity): boolean {
    return session.nameSource !== null;
  }
}

/**
 * The agent finished answering: `done`, or back at its prompt (`idle`). An
 * `idle` before it ever worked passes too, and costs one read that finds too
 * few prompts.
 */
function finishedAnswer(event: WorkSessionEventEntity): boolean {
  if (event.kind !== SESSION_EVENT_KINDS.AGENT_OBSERVED) return false;
  if (typeof event.payload !== 'object' || event.payload === null) return false;
  const state = (event.payload as { state?: unknown }).state;
  return state === 'done' || state === 'idle';
}

/** The prompt the runner reported, narrowed once so nothing downstream casts. */
function promptTextOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const text = (payload as { text?: unknown }).text;
  return typeof text === 'string' && text.trim() ? text : null;
}
