import { Inject, Injectable, Logger } from '@nestjs/common';
import { BOT_TURN_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotTurnRepositoryPort } from '../database/bot-turn.repository.port';

/** How long a running turn waits between two looks for Stop. */
export const CANCEL_POLL_MS = 750;

/** A running turn's look-out for Stop. */
export interface TurnCancelWatch {
  /** Aborts once Stop is pressed on the turn. */
  readonly signal: AbortSignal;
  /** Stops looking. Safe to call more than once. */
  stop(): void;
}

/**
 * Builds the watch a running turn keeps for Stop (`25-bots.md` §2): it reads
 * the turn's cancel request every `CANCEL_POLL_MS`, starting the next read
 * only once the last has settled, so a slow database never stacks reads.
 * A read that fails is logged and the watch keeps looking; Stop aborts the
 * signal and ends the watch.
 */
@Injectable()
export class TurnCancelWatchFactory {
  private readonly logger = new Logger(TurnCancelWatchFactory.name);

  constructor(@Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort) {}

  watch(turnId: string): TurnCancelWatch {
    const abort = new AbortController();
    let stopped = false;
    let timer: NodeJS.Timeout | undefined;

    const look = async (): Promise<void> => {
      try {
        if (await this.turns.isCancelRequested(turnId)) {
          if (!stopped) abort.abort();
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
      stop: () => {
        stopped = true;
        clearTimeout(timer);
      },
    };
  }
}
