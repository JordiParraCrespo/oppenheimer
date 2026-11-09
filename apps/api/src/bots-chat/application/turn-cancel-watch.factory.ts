import { Inject, Injectable, Logger } from '@nestjs/common';
import type { BotEngineEvent } from '@oppenheimer/backend-agents';
import { BOT_TURN_IDLE_LIMIT_MS } from '@oppenheimer/shared';
import { BOT_TURN_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotTurnRepositoryPort } from '../database/bot-turn.repository.port';
import { TurnActivity } from './turn-activity.policy';

/** How long a running turn waits between two looks for Stop. */
export const CANCEL_POLL_MS = 750;

/**
 * What ended a turn from outside the engine: Stop, its model sending nothing
 * for `BOT_TURN_IDLE_LIMIT_MS` while none of its tools ran, or the engine's
 * loop guard refusing `BOT_TURN_LOOP_REFUSALS` of its calls.
 */
export type TurnInterruption = 'stop' | 'stalled' | 'loop';

/** A running turn's look-out for Stop, for a model gone silent and for a turn going round in circles. */
export interface TurnCancelWatch {
  /** Aborts once Stop is pressed on the turn, or once it stalls or loops. */
  readonly signal: AbortSignal;
  /** What aborted the signal, once one of them has; null while none has. */
  readonly interruption: TurnInterruption | null;
  /** Takes in one of the engine's events: it shows the turn is alive, and may show it looping. */
  saw(event: BotEngineEvent): void;
  /** Stops looking. Safe to call more than once. */
  stop(): void;
}

/**
 * Builds the watch a running turn keeps for Stop (`25-bots.md` §2): it reads
 * the turn's cancel request every `CANCEL_POLL_MS`, starting the next read
 * only once the last has settled, so a slow database never stacks reads.
 * A read that fails is logged and the watch keeps looking; Stop aborts the
 * signal and ends the watch. A turn has no time limit (`25-bots.md` §2,
 * 2026-11-09); the same signal aborts when the engine has said nothing for
 * `idleLimitMs` while none of the turn's tools runs (a call of ours may take
 * as long as it takes; a provider retry stretches the wait by its delay),
 * and when the loop guard has refused `BOT_TURN_LOOP_REFUSALS` calls.
 */
@Injectable()
export class TurnCancelWatchFactory {
  private readonly logger = new Logger(TurnCancelWatchFactory.name);

  constructor(@Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort) {}

  watch(turnId: string, idleLimitMs = BOT_TURN_IDLE_LIMIT_MS): TurnCancelWatch {
    const abort = new AbortController();
    let stopped = false;
    let interruption: TurnInterruption | null = null;
    let timer: NodeJS.Timeout | undefined;
    let idle: NodeJS.Timeout | undefined;
    const activity = new TurnActivity();
    const interrupt = (cause: TurnInterruption): void => {
      if (stopped || interruption) return;
      interruption = cause;
      abort.abort();
    };
    const awake = (graceMs: number | null): void => {
      clearTimeout(idle);
      if (stopped || graceMs === null) return;
      idle = setTimeout(() => interrupt('stalled'), idleLimitMs + graceMs);
      idle.unref();
    };
    const saw = (event: BotEngineEvent): void => {
      const reading = activity.saw(event);
      if (reading.looping) interrupt('loop');
      awake(reading.graceMs);
    };
    awake(0);

    const look = async (): Promise<void> => {
      try {
        if (await this.turns.isCancelRequested(turnId)) {
          interrupt('stop');
          return;
        }
      } catch (error) {
        this.logger.warn({
          message: 'Could not read whether a bot turn was stopped',
          turnId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      next();
    };
    const next = (): void => {
      if (stopped) return;
      timer = setTimeout(() => void look(), CANCEL_POLL_MS);
      timer.unref();
    };

    next();
    return {
      signal: abort.signal,
      get interruption() {
        return interruption;
      },
      saw,
      stop: () => {
        stopped = true;
        clearTimeout(timer);
        clearTimeout(idle);
      },
    };
  }
}
