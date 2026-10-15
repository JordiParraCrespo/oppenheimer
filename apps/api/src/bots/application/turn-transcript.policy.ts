import type { BotEngineEvent } from '@oppenheimer/backend-agents';
import { AppError } from '@oppenheimer/backend-core';
import {
  BOT_TOOL_OUTPUT_MAX,
  BotMessageEntity,
  type BotToolStep,
} from '../domain/bot-message.entity';
import type { BotTurnEntity } from '../domain/bot-turn.entity';

/** What one engine event asks the runner to do. */
export type TranscriptWrite =
  | { kind: 'insert'; message: BotMessageEntity }
  | { kind: 'steps'; message: BotMessageEntity }
  | { kind: 'text'; text: string };

/** How the engine said the turn ended, and what it cost. */
export interface TranscriptOutcome {
  reason: 'completed' | 'cancelled' | 'max_steps' | 'failed';
  error: string | null;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Turns a turn's engine events into the chat's messages (`25-bots.md` §3):
 * each finished block of text is a message, and each run of tool calls
 * between two of them is one activity line whose steps fill in as the calls
 * finish. Text as it streams is only passed on. Your message is position 0,
 * so the bot's start at 1.
 */
export class TurnTranscript {
  private position = 1;
  private pending = '';
  private activity: BotMessageEntity | null = null;
  private outcome: TranscriptOutcome = {
    reason: 'failed',
    error: 'The turn ended without saying how',
    inputTokens: 0,
    outputTokens: 0,
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
        return this.finished(event.callId, event.output, event.isError);
      case 'usage':
        this.outcome.inputTokens += event.inputTokens;
        this.outcome.outputTokens += event.outputTokens;
        return [];
      case 'done': {
        this.outcome.reason = event.reason;
        this.outcome.error = event.reason === 'failed' ? (event.error ?? null) : null;
        const unsaid = this.pending;
        this.pending = '';
        return this.say(unsaid);
      }
    }
  }

  get result(): TranscriptOutcome {
    return this.outcome;
  }

  /** Ends the turn as the engine said it ended; running out of steps still completes it. */
  endTurn(now: Date): void {
    const { reason, error, inputTokens, outputTokens } = this.outcome;
    const status = reason === 'completed' || reason === 'max_steps' ? 'completed' : reason;
    this.turn.end(status, now, { error, inputTokens, outputTokens });
  }

  private say(text: string): TranscriptWrite[] {
    if (!text.trim()) return [];
    this.activity = null;
    return [{ kind: 'insert', message: this.message('assistant', text, []) }];
  }

  private started(callId: string, name: string, input: unknown): TranscriptWrite[] {
    const step: BotToolStep = { callId, name, input, output: null, isError: false };
    if (this.activity) {
      this.activity.steps.push(step);
      return [{ kind: 'steps', message: this.activity }];
    }
    this.activity = this.message('activity', '', [step]);
    return [{ kind: 'insert', message: this.activity }];
  }

  private finished(callId: string, output: string, isError: boolean): TranscriptWrite[] {
    const step = this.activity?.steps.find((candidate) => candidate.callId === callId);
    if (!this.activity || !step) return [];
    step.output =
      output.length > BOT_TOOL_OUTPUT_MAX ? `${output.slice(0, BOT_TOOL_OUTPUT_MAX)}…` : output;
    step.isError = isError;
    return [{ kind: 'steps', message: this.activity }];
  }

  private message(role: 'assistant' | 'activity', content: string, steps: BotToolStep[]) {
    return BotMessageEntity.createNew({
      organizationId: this.turn.organizationId,
      botId: this.turn.botId,
      turnId: this.turn.id,
      role,
      content,
      steps,
      position: this.position++,
    });
  }
}

/** A turn's failure in words a person can act on: the catalog's for ours, the engine's otherwise. */
export function failureReasonOf(error: unknown): string {
  if (error instanceof AppError) return error.message;
  return error instanceof Error ? error.message.slice(0, 500) : 'The turn failed';
}
