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
   * Pauses the goal as it now stands (its pause, what it spent, its idle
   * turns) and writes the line that says why, in one transaction, on the
   * count it was loaded at while it ran; false, and no line, when another
   * writer moved it first (ended, paused, continued). `spend` says whether
   * the turn that paused it still owes its spend (`owed`: the bot paused it
   * mid-turn, before the turn's tokens were known; `recordSpend` adds them
   * once) or the pause carries it already (`counted`: the end of a turn
   * paused it after counting it, so nothing more is owed).
   */
  pause(goal: BotGoalEntity, line: BotMessageEntity, spend: 'owed' | 'counted'): Promise<boolean>;
  /**
   * Lifts a pause whose turn has not been counted yet (`owed`, its end still
   * to come) in place, with the owner's line: the count stays, so that turn's
   * end counts it and decides as for a running goal. False, and no line, when
   * the pause is not that one any more (its turn's end counted it, or another
   * writer moved the goal): the caller resumes it as usual.
   */
  resumeOwed(goal: BotGoalEntity, line: BotMessageEntity): Promise<boolean>;
  /**
   * Writes what the turn that paused a goal spent, once: only while the goal
   * is still paused as it was and its pause still owes it (a pause whose
   * spend is `owed` leaves `updatedAt` at the pause's time; this write, or a
   * pause that `counted` it, moves it on), so a second delivery of the same
   * end adds nothing. False when it wrote nothing.
   */
  recordSpend(goal: BotGoalEntity): Promise<boolean>;
  /** Stores the bot's claim that the goal is met; false when the goal is gone. */
  claim(goal: BotGoalEntity): Promise<boolean>;
}
