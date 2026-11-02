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
}
