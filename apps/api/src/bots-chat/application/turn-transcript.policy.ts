import type { BotEngineEvent, BotEngineFailure } from '@oppenheimer/backend-agents';
import { AppError } from '@oppenheimer/backend-core';
import type { BotAttachment, BotStreamEvent, BotTurnFailure } from '@oppenheimer/shared';
import { BotErrors } from '../../bots/domain/bots.errors';
import { MAIL_DRAFT_DATA_KEY } from '../bot-mail-tool.mapper';
import { toMailDraft, toShownImages, toSubagentRuns } from '../bot-message.mapper';
import { ALLOWED_BY_DATA_KEY, BOT_ALLOWED_BY_MAX } from '../domain/bot-approval.policy';
import {
  BOT_TOOL_OUTPUT_MAX,
  BotMessageEntity,
  type BotToolStep,
} from '../domain/bot-message.entity';
import { SHOWN_IMAGES_DATA_KEY } from '../domain/bot-shown-image.policy';
import { SUBAGENT_DATA_KEY } from '../domain/bot-subagent.policy';
import {
  BOT_TURN_TIME_LIMIT_MS,
  type BotTurnContext,
  type BotTurnEntity,
  type BotTurnPlanLimits,
} from '../domain/bot-turn.entity';
import type { TurnInterruption } from './turn-cancel-watch.factory';

/** What one engine event asks the runner to do. */
export type TranscriptWrite =
  | { kind: 'insert'; message: BotMessageEntity }
  | { kind: 'steps'; message: BotMessageEntity }
  | { kind: 'text'; text: string }
  /** A message the person steered in, put after the call whose result carried it to the model. */
  | { kind: 'steer'; messageId: string; position: number }
  /** The engine waits to try a refused call again; passed on, never stored. */
  | { kind: 'retrying'; reason: 'rate_limit' | 'unavailable' };

/** How the engine said the turn ended, and what it cost. */
export interface TranscriptOutcome {
  reason: 'completed' | 'cancelled' | 'max_steps' | 'failed';
  error: string | null;
  /** What kind of failure the engine said it was; null unless it failed. */
  failure: BotEngineFailure | null;
  inputTokens: number;
  outputTokens: number;
  /** What the context held at the last answer that reported it. */
  context: BotTurnContext | null;
  /** A subscription's windows as its last answer said them. */
  planLimits: BotTurnPlanLimits | null;
}

/**
 * Turns a turn's engine events into the chat's messages (`25-bots.md` §3):
 * each finished block of text is a message, and each run of tool calls
 * between two of them is one activity line whose steps fill in as the calls
 * finish. The images a `show_image` call stored are a message of the bot's
 * of their own, after the line, which the next call does not join. Text as
 * it streams is only passed on. Your message is position 0,
 * so the bot's start at 1. A message you steered in while it worked takes
 * the next position once the call that delivered it has ended, and the next
 * call opens a line of its own after it.
 */
export class TurnTranscript {
  private position = 1;
  private pending = '';
  private activity: BotMessageEntity | null = null;
  private outcome: TranscriptOutcome = {
    reason: 'failed',
    error: 'The turn ended without saying how',
    failure: 'other',
    inputTokens: 0,
    outputTokens: 0,
    context: null,
    planLimits: null,
  };

  constructor(private readonly turn: BotTurnEntity) {}

  apply(event: BotEngineEvent): TranscriptWrite[] {
    switch (event.type) {
      case 'text.delta':
        this.activity = null;
        this.pending += event.text;
        return [{ kind: 'text', text: event.text }];
      case 'text.done':
        this.pending = '';
        return this.say(event.text);
      case 'tool.started':
        return this.started(event.callId, event.name, event.input);
      case 'tool.finished':
        return this.finished(event);
      case 'retrying':
        return [{ kind: 'retrying', reason: event.reason }];
      case 'steered':
        this.activity = null;
        return event.steers.map((steer) => ({
          kind: 'steer' as const,
          messageId: steer.id,
          position: this.position++,
        }));
      case 'usage':
        this.outcome.inputTokens += event.inputTokens;
        this.outcome.outputTokens += event.outputTokens;
        this.outcome.context = event.context ?? this.outcome.context;
        this.outcome.planLimits = event.limits ?? this.outcome.planLimits;
        return [];
      case 'done': {
        this.outcome.reason = event.reason;
        this.outcome.error = event.reason === 'failed' ? (event.error ?? null) : null;
        this.outcome.failure = event.reason === 'failed' ? (event.failure ?? 'other') : null;
        const unsaid = this.pending;
        this.pending = '';
        return this.say(unsaid);
      }
    }
  }

  get result(): TranscriptOutcome {
    return this.outcome;
  }

  /**
   * Ends the turn. What interrupted it from outside decides first: Stop
   * cancels it, the time limit fails it with a message saying so (what it
   * wrote is kept). Otherwise it ends as the engine said; running out of
   * steps still completes it.
   */
  endTurn(now: Date, interruption: TurnInterruption | null): void {
    const { reason, error, failure, inputTokens, outputTokens, context, planLimits } = this.outcome;
    const usage = { inputTokens, outputTokens, context, planLimits };
    if (interruption === 'time_limit') {
      this.turn.end('failed', now, { error: TIME_LIMIT_ERROR, failure: 'time_limit', ...usage });
    } else if (interruption === 'stop') {
      this.turn.end('cancelled', now, usage);
    } else {
      const status = reason === 'completed' || reason === 'max_steps' ? 'completed' : reason;
      this.turn.end(status, now, { error, failure, ...usage });
    }
  }

  private say(text: string): TranscriptWrite[] {
    if (!text.trim()) return [];
    this.activity = null;
    return [{ kind: 'insert', message: this.message('assistant', text, []) }];
  }

  private started(callId: string, name: string, input: unknown): TranscriptWrite[] {
    const step: BotToolStep = {
      callId,
      name,
      input,
      output: null,
      isError: false,
      sessionId: null,
      subagents: null,
      allowedBy: null,
      mailDraft: null,
    };
    if (this.activity) {
      this.activity.steps.push(step);
      return [{ kind: 'steps', message: this.activity }];
    }
    this.activity = this.message('activity', '', [step]);
    return [{ kind: 'insert', message: this.activity }];
  }

  /**
   * A call's end: its words, cut, and what the tool said it made: the
   * session it started, the children it ran, whose tokens are the turn's
   * cost too, the draft it saved, or the images it showed, which follow the
   * line as a message.
   */
  private finished(event: Extract<BotEngineEvent, { type: 'tool.finished' }>): TranscriptWrite[] {
    const { callId, output, isError, data } = event;
    const step = this.activity?.steps.find((candidate) => candidate.callId === callId);
    if (!this.activity || !step) return [];
    step.output =
      output.length > BOT_TOOL_OUTPUT_MAX ? `${output.slice(0, BOT_TOOL_OUTPUT_MAX)}…` : output;
    step.isError = isError;
    step.sessionId = isError ? null : (data?.sessionId ?? null);
    step.subagents = isError ? null : toSubagentRuns(data?.[SUBAGENT_DATA_KEY]);
    step.allowedBy = data?.[ALLOWED_BY_DATA_KEY]?.slice(0, BOT_ALLOWED_BY_MAX) ?? null;
    step.mailDraft = isError ? null : toMailDraft(data?.[MAIL_DRAFT_DATA_KEY]);
    for (const run of step.subagents ?? []) {
      this.outcome.inputTokens += run.inputTokens;
      this.outcome.outputTokens += run.outputTokens;
    }
    const writes: TranscriptWrite[] = [{ kind: 'steps', message: this.activity }];
    const images = isError ? [] : toShownImages(data?.[SHOWN_IMAGES_DATA_KEY]);
    if (images.length > 0) {
      this.activity = null;
      writes.push({ kind: 'insert', message: this.message('assistant', '', [], images) });
    }
    return writes;
  }

  private message(
    role: 'assistant' | 'activity',
    content: string,
    steps: BotToolStep[],
    attachments: readonly BotAttachment[] = [],
  ) {
    return BotMessageEntity.createNew({
      organizationId: this.turn.organizationId,
      botId: this.turn.botId,
      turnId: this.turn.id,
      role,
      content,
      steps,
      position: this.position++,
      attachments,
    });
  }
}

/**
 * A write that is passed on and never stored (text as it streams, a retry
 * wait), as the bot's stream says it.
 */
export function passedOnEvent(
  turnId: string,
  write: Extract<TranscriptWrite, { kind: 'text' | 'retrying' }>,
): BotStreamEvent {
  return write.kind === 'text'
    ? { type: 'text', turnId, text: write.text }
    : { type: 'retrying', turnId, reason: write.reason };
}

/** Why a turn the time limit stopped failed, in words a person can act on. */
export const TIME_LIMIT_ERROR = `Stopped after ${BOT_TURN_TIME_LIMIT_MS / 60_000} minutes, the limit for one turn. Ask for a smaller step, or split the request.`;

/** A turn's failure in words a person can act on: the catalog's for ours, the engine's otherwise. */
export function failureReasonOf(error: unknown): string {
  if (error instanceof AppError) return error.message;
  return error instanceof Error ? error.message.slice(0, 500) : 'The turn failed';
}

/** How a turn that threw ended: its failure in words, and the kind it was. */
export function thrownFailure(error: unknown): { error: string; failure: BotTurnFailure } {
  return { error: failureReasonOf(error), failure: failureKindOf(error) };
}

/**
 * The kind of failure a turn that threw before or around its engine is. A
 * provider with no key or sign-in for the turn is fixed in Settings, so it
 * is a credential failure; ChatGPT refreshing its sign-in passes, so it is
 * the provider being unavailable for a moment. Anything else is not known.
 */
export function failureKindOf(error: unknown): BotTurnFailure {
  if (!(error instanceof AppError)) return 'other';
  if (error.code === BotErrors.PROVIDER_KEY_MISSING.code) return 'credential';
  if (error.code === BotErrors.CHATGPT_REFRESHING.code) return 'unavailable';
  return 'other';
}
