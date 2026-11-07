import { Inject, Injectable } from '@nestjs/common';
import { BOT_TURN_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotTurnRepositoryPort } from '../database/bot-turn.repository.port';
import { goalFromMessage } from '../domain/bot-goal.policy';
import { loopFromMessage } from '../domain/bot-loop.policy';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import { BotGoalResolver } from './bot-goal.resolver';
import { BotLoopResolver } from './bot-loop.resolver';

type SentOutcome = 'staged' | 'waiting' | 'missing' | 'attachments_taken';

/**
 * A built-in that sets something with the turn that sends it: what the
 * message sets, how the turn is queued with it, and what becomes of the one
 * it replaced. One entry per built-in, so the next is an entry, not a branch.
 */
interface BuiltInSetter<Set> {
  /** What the message sets; null when it is not this built-in. */
  from(turn: BotTurnEntity, message: BotMessageEntity): Set | null;
  /** Queues the turn with it, in one transaction; answers what it replaced. */
  enqueue(
    turn: BotTurnEntity,
    message: BotMessageEntity,
    set: Set,
    correlationId: string | null,
  ): Promise<{ outcome: SentOutcome; replaced: Set | null }>;
  /** The one it replaced goes with the turn that one left waiting. */
  retire(replaced: Set, correlationId: string | null): Promise<void>;
}

/** A setter as the walk runs it: the outcome when the message was its, null when not. */
type QueueWith = (
  turn: BotTurnEntity,
  message: BotMessageEntity,
  correlationId: string | null,
) => Promise<SentOutcome | null>;

function queueWith<Set>(setter: BuiltInSetter<Set>): QueueWith {
  return async (turn, message, correlationId) => {
    const set = setter.from(turn, message);
    if (set === null) return null;
    const { outcome, replaced } = await setter.enqueue(turn, message, set, correlationId);
    if (replaced !== null) await setter.retire(replaced, correlationId);
    return outcome;
  };
}

/**
 * A sent message's turn, queued with what its built-in sets (`25-bots.md`
 * §4.1, "Built-in commands"): `/goal <condition>` sets the bot's goal and
 * `/loop …` its loop, in the transaction that queues the turn, so the turn
 * never runs, or ends, without it. The first setter whose command the
 * message is queues it; any other message is queued as it is.
 */
@Injectable()
export class BotSentTurnResolver {
  private readonly setters: readonly QueueWith[];

  constructor(
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    goals: BotGoalResolver,
    loops: BotLoopResolver,
  ) {
    this.setters = [
      queueWith({
        from: (turn, message) => goalFromMessage(message.content, turn),
        enqueue: (turn, message, goal, cid) => turns.enqueueWithGoal(turn, message, goal, cid),
        retire: (replaced, cid) => goals.cancelWaiting(replaced, cid),
      }),
      queueWith({
        from: (turn, message) => loopFromMessage(message.content, turn, new Date()),
        enqueue: (turn, message, loop, cid) => turns.enqueueWithLoop(turn, message, loop, cid),
        retire: (replaced, cid) => loops.cancelWaiting(replaced, cid),
      }),
    ];
  }

  async queue(
    turn: BotTurnEntity,
    message: BotMessageEntity,
    correlationId: string | null,
  ): Promise<SentOutcome> {
    for (const setter of this.setters) {
      const outcome = await setter(turn, message, correlationId);
      if (outcome !== null) return outcome;
    }
    return this.turns.enqueue(turn, message, correlationId);
  }
}
