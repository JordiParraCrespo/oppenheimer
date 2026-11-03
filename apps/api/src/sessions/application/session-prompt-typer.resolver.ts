import { Inject, Injectable } from '@nestjs/common';
import type {
  SessionAppendOutcome,
  WorkSessionRepositoryPort,
} from '../database/work-session.repository.port';
import {
  PROMPT_SUBMIT_GAP_MS,
  promptKeys,
  promptRefusal,
  type SessionPromptSender,
} from '../domain/session-prompt.policy';
import { SESSION_EVENT_KINDS } from '../domain/session-state.policy';
import { WorkSessionEntity } from '../domain/work-session.entity';
import { SESSION_DISPATCH, WORK_SESSION_REPOSITORY } from '../sessions.di-tokens';
import type { SessionDispatchPort } from './session-dispatch.port';

/** The agent's window, where its prompt is drawn. */
const AGENT_WINDOW = 0;

/**
 * What typing a prompt came to: `not-ready` when the agent could not take
 * it (the reason is `promptRefusal`'s), `claimed-before` when this command's
 * claim was already in the log (a retry: its keys were sent then),
 * `undelivered` when the host could not take the keys, or `typed`.
 */
export type TypedPrompt =
  | { outcome: 'not-ready'; reason: string }
  | { outcome: 'claimed-before' }
  | { outcome: 'undelivered' }
  | { outcome: 'typed'; seq: number | undefined };

/**
 * Types a follow-up prompt into a running session's agent for somebody other
 * than a person at its terminal: a bot (issue #493) or a wake
 * (`product/next-steps/agent-tools.md` §3). The prompt is claimed first, as
 * `prompt.sent` appended only while the agent still waits at its prompt and
 * no other prompt is waiting to be taken, with the sender as the API read
 * it: the log, not the words, says who spoke, and of two prompts sent at once
 * one types and the other is refused. The keys go after the claim; a host
 * that cannot take them gets `prompt.undelivered`, which cancels the turn the
 * claim opened. The claim is keyed by `commandId`, so a caller that retries
 * with the same id types once.
 */
@Injectable()
export class SessionPromptTyperResolver {
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
  ) {}

  async type(
    session: WorkSessionEntity,
    prompt: { commandId: string; text: string; sender: SessionPromptSender },
  ): Promise<TypedPrompt> {
    const notReady = promptRefusal(session.fold, session.latestTurn);
    if (notReady) return { outcome: 'not-ready', reason: notReady };

    const claimed: SessionAppendOutcome | null = await this.sessions.appendEventsIf(
      session,
      [
        this.entry(prompt.commandId, SESSION_EVENT_KINDS.PROMPT_SENT, {
          text: prompt.text,
          sender: prompt.sender,
        }),
      ],
      (fold, latestTurn) => promptRefusal(fold, latestTurn) === null,
    );
    if (!claimed) {
      return {
        outcome: 'not-ready',
        reason: 'The agent moved on before the prompt could be sent.',
      };
    }
    if (claimed.appended.length === 0) return { outcome: 'claimed-before' };

    const { delivered } = await this.dispatch.typeKeys(session, {
      window: AGENT_WINDOW,
      keys: promptKeys(prompt.text),
      gapMs: PROMPT_SUBMIT_GAP_MS,
    });
    if (!delivered) {
      await this.sessions.appendEvents(session, [
        this.entry(prompt.commandId, SESSION_EVENT_KINDS.PROMPT_UNDELIVERED, {
          id: prompt.commandId,
        }),
      ]);
      return { outcome: 'undelivered' };
    }
    return { outcome: 'typed', seq: claimed.appended.at(-1)?.seq };
  }

  private entry(commandId: string, kind: string, payload: unknown) {
    return {
      idempotencyKey: WorkSessionEntity.apiIdempotencyKey(commandId, kind),
      source: 'api' as const,
      kind,
      payload,
    };
  }
}
