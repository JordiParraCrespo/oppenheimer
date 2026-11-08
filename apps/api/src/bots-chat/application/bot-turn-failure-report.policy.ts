import { Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import { ErrorReporter } from '@oppenheimer/backend-error-reporting';
import { BotTurnMapper } from '../bot-turn.mapper';
import type { BotTurnEntity } from '../domain/bot-turn.entity';

/**
 * Which failed turns are reported (`ErrorReporter`): the ones that are ours to
 * fix. An error thrown around the engine that the catalog does not know is an
 * error; a failure the engine could not put a kind to (`other`) is a warning.
 * A failure with a kind (a rate limit, a refused key, the time limit) is the
 * provider's or the person's, and the chat already says so.
 */
@Injectable()
export class BotTurnFailureReportPolicy {
  constructor(private readonly reporter: ErrorReporter) {}

  /** After the engine ended the turn. */
  ended(turn: BotTurnEntity): void {
    if (turn.status !== 'failed' || turn.failure !== 'other') return;
    this.reporter.capture(
      new BotTurnFailedError(turn.error ?? 'The turn ended without saying why'),
      BotTurnMapper.toErrorReport(turn, 'warning'),
    );
  }

  /** After the turn threw. */
  thrown(turn: BotTurnEntity, error: unknown): void {
    if (error instanceof AppError) return;
    this.reporter.capture(error, BotTurnMapper.toErrorReport(turn, 'error'));
  }
}

/** A failure the engine reported rather than threw, as an error the reporter can group. */
class BotTurnFailedError extends Error {
  override readonly name = 'BotTurnFailedError';
}
