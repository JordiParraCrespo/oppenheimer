import { type BotEngineEvent, LOOP_GUARD_DATA_KEY } from '@oppenheimer/backend-agents';
import { BOT_TURN_LOOP_REFUSALS } from '../domain/bot-turn.entity';

/** What one of the engine's events says about a running turn. */
export interface TurnActivityReading {
  /** The loop guard has refused `BOT_TURN_LOOP_REFUSALS` of its calls: the turn stops as `loop`. */
  looping: boolean;
  /**
   * How long beyond the idle limit the model may now stay silent before the
   * turn stalls (a provider retry's delay); null while one of its tools
   * runs, when silence is the tool's and not the model's.
   */
  graceMs: number | null;
}

/**
 * The state the cancel watch reads from a turn's events, kept apart from its
 * timers (`TurnCancelWatchFactory`): how many tools are running, so a tool
 * that takes long is not a silent model, and how many calls the engine's
 * loop guard has refused. A new reason to stop a turn from what its events
 * say is a field here, not another counter in the watch.
 */
export class TurnActivity {
  private toolsRunning = 0;
  private refusals = 0;

  saw(event: BotEngineEvent): TurnActivityReading {
    if (event.type === 'tool.started') this.toolsRunning += 1;
    if (event.type === 'tool.finished') {
      this.toolsRunning = Math.max(0, this.toolsRunning - 1);
      if (event.data?.[LOOP_GUARD_DATA_KEY] === 'refused') this.refusals += 1;
    }
    return {
      looping: this.refusals >= BOT_TURN_LOOP_REFUSALS,
      graceMs: this.toolsRunning > 0 ? null : event.type === 'retrying' ? (event.delayMs ?? 0) : 0,
    };
  }
}
