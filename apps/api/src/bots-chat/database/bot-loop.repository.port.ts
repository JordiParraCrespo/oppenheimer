import type { BotLoopEntity } from '../domain/bot-loop.entity';
import type { BotMessageEntity } from '../domain/bot-message.entity';

export interface BotLoopRepositoryPort {
  /** The bot's loop, if it has one. */
  findForBot(organizationId: string, botId: string): Promise<BotLoopEntity | null>;
  /** The worker's read: by id alone, the job carries nothing else it can trust. */
  findForRun(loopId: string): Promise<BotLoopEntity | null>;
  /**
   * Sets when the loop runs next and stages that run, conditional on the
   * count it was loaded at; false when the loop ended or a run was queued
   * meanwhile.
   */
  schedule(loop: BotLoopEntity, at: Date, correlationId: string | null): Promise<boolean>;
  /**
   * Ends the loop and writes the line that says how, in one transaction;
   * false, and no line, when it had already ended.
   */
  end(loop: BotLoopEntity, line: BotMessageEntity | null): Promise<boolean>;
}
