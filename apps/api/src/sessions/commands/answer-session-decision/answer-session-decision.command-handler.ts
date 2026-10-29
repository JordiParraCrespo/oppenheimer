import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { QUESTION_KEY_GAP_MS } from '@oppenheimer/shared/sessions';
import type { SessionDispatchPort } from '../../application/session-dispatch.port';
import { requireOnHost, SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import type { SessionCommandResult } from '../../domain/session-command.types';
import { decisionAnswerKeys } from '../../domain/session-decision.policy';
import { SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { SESSION_DISPATCH, WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { AnswerSessionDecisionCommand } from './answer-session-decision.command';

/** The agent's window: where its question and its permission dialog are drawn. */
const AGENT_WINDOW = 0;

/**
 * Answers what a session's agent waits on — a question it asked, a permission
 * dialog — from somewhere other than its terminal: the Inbox
 * (`product/versions/mvp/29-inbox.md` slice 4).
 *
 * The answer is the keys a person would type, sent to window 0 as
 * `session.input`, one frame per key and paced like the console's chat view
 * paces them. It names the decision it answers, so an answer to a question
 * that was already answered, or replaced, is refused rather than typed into
 * whatever the agent asks next.
 *
 * Order: the answer is claimed first, as `decision.answered` appended only while
 * the row still waits on that decision, so of two answers sent at once (two
 * tabs, a double click) one types its keys and the other is refused as stale
 * — checking and typing first let both through, and the agent read both
 * answers as its next ones. The keys go after the claim; a host that cannot
 * take them gets the decision back (an `agent.decision` restating it, unless
 * the runner has reported something since), so it stays answerable. The
 * runner's next report (the agent at work, or its next question) confirms.
 */
@CommandHandler(AnswerSessionDecisionCommand)
export class AnswerSessionDecisionCommandHandler
  implements ICommandHandler<AnswerSessionDecisionCommand, SessionCommandResult>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
  ) {}

  async execute(command: AnswerSessionDecisionCommand): Promise<SessionCommandResult> {
    const session = requireOnHost(await this.loader.find(command.scope, command.sessionId));
    const refusal = session.inputRefusal;
    if (refusal) {
      throw new AppError(refusal, { detail: `Session ${session.slug} cannot take input` });
    }

    const outcome = decisionAnswerKeys(session.pendingDecision, command.answer);
    if (outcome.kind !== 'keys') {
      const refusal =
        outcome.kind === 'stale'
          ? SessionErrors.DECISION_STALE
          : SessionErrors.DECISION_ANSWER_INVALID;
      throw new AppError(refusal, { detail: outcome.detail });
    }

    const decision = session.pendingDecision;
    const claimed = await this.sessions.appendEventsIf(
      session,
      [this.entry(command, SESSION_EVENT_KINDS.DECISION_ANSWERED, { id: command.answer.id })],
      (fold) => fold.pendingDecision?.id === command.answer.id,
    );
    if (!claimed) {
      throw new AppError(SessionErrors.DECISION_STALE, {
        detail: 'Another answer to this decision was taken first.',
      });
    }

    const { delivered } = await this.dispatch.typeKeys(session, {
      window: AGENT_WINDOW,
      keys: outcome.keys,
      gapMs: QUESTION_KEY_GAP_MS,
    });
    if (!delivered) {
      await this.sessions.appendEventsIf(
        session,
        [this.entry(command, SESSION_EVENT_KINDS.AGENT_DECISION, { decision })],
        (fold) => fold.pendingDecision === null,
      );
      throw new AppError(SessionErrors.DECISION_HOST_OFFLINE, {
        detail: 'Nothing is kept for a host that comes back: answer again once it is online.',
      });
    }
    return { sessionId: session.id, hints: [], seq: claimed.appended.at(-1)?.seq };
  }

  private entry(command: AnswerSessionDecisionCommand, kind: string, payload: unknown) {
    return {
      idempotencyKey: WorkSessionEntity.apiIdempotencyKey(command.id, kind),
      source: 'api' as const,
      kind,
      payload,
    };
  }
}
