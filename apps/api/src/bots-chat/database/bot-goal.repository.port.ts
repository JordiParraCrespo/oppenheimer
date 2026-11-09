import type { BotGoalEntity } from '../domain/bot-goal.entity';
import type { BotMessageEntity } from '../domain/bot-message.entity';

export interface BotGoalRepositoryPort {
  /** The bot's goal, if it has one. */
  findForBot(organizationId: string, botId: string): Promise<BotGoalEntity | null>;
  /** Sets the bot's goal in place of the one it had; answers the one replaced. */
  set(goal: BotGoalEntity): Promise<BotGoalEntity | null>;
  /**
   * Ends the goal and writes the line that says how, in one transaction;
   * false, and no line, when it had already ended.
   */
  end(goal: BotGoalEntity, line: BotMessageEntity | null): Promise<boolean>;
  /**
   * Pauses the goal and writes the line that says why, in one transaction, on
   * the count it was loaded at while it ran; false, and no line, when another
   * writer moved it first (ended, paused, continued). What it spent is not
   * this write's: `countTurnSpend` adds each turn's.
   */
  pause(goal: BotGoalEntity, line: BotMessageEntity): Promise<boolean>;
  /**
   * Adds what one of the goal's turns spent (its tokens, and whether it went
   * idle) to the goal, once per turn whatever writes the goal saw since: the
   * turn is marked counted in the same transaction, and the add is to what
   * the row holds, never a loaded copy. False when the turn was counted
   * already, and nothing is added.
   */
  countTurnSpend(goal: BotGoalEntity, turn: GoalTurnSpend): Promise<boolean>;
  /** Stores the bot's claim that the goal is met; false when the goal is gone or paused. */
  claim(goal: BotGoalEntity): Promise<boolean>;
}

/** What one turn of a goal spent: its tokens, and whether it called a tool. */
export interface GoalTurnSpend {
  id: string;
  tokens: number;
  calledTools: boolean;
}
