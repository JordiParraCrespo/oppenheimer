import { Inject, Injectable, Logger } from '@nestjs/common';
import { BOT_DREAM_INTERVAL_MS } from '@oppenheimer/shared';
import { BOT_REPOSITORY } from '../../bots/bots.di-tokens';
import type { BotRepositoryPort } from '../../bots/database/bot.repository.port';
import { BOT_MEMORY_DREAM_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotMemoryDreamRepositoryPort } from '../database/bot-memory-dream.repository.port';
import { shouldDream } from '../domain/bot-dream.policy';
import type { BotTurnEntity } from '../domain/bot-turn.entity';

/**
 * After a turn ends (`25-bots.md` §4.1, "Dreaming"): whether the bot has
 * written enough to its memory since its last dream to dream again, and if
 * so a job that does. The job decides again on what it reads, so a job staged
 * twice dreams once. The turn has ended when this runs, so a failure here is
 * logged and nothing more: the next turn's end asks again.
 */
@Injectable()
export class BotDreamTriggerPolicy {
  private readonly logger = new Logger(BotDreamTriggerPolicy.name);

  constructor(
    @Inject(BOT_REPOSITORY) private readonly bots: BotRepositoryPort,
    @Inject(BOT_MEMORY_DREAM_REPOSITORY) private readonly dreams: BotMemoryDreamRepositoryPort,
  ) {}

  /** Whether a dream was staged. */
  async afterTurn(turn: BotTurnEntity, correlationId: string | null): Promise<boolean> {
    try {
      const bot = await this.bots.findForTurn(turn.organizationId, turn.botId);
      if (bot.isNone()) return false;
      const weight = await this.dreams.weigh(turn.organizationId, turn.botId);
      if (!shouldDream({ ...weight, learns: bot.unwrap().learnAutomatically }, new Date())) {
        return false;
      }
      return await this.dreams.stageDream(
        turn.organizationId,
        turn.botId,
        BOT_DREAM_INTERVAL_MS,
        correlationId,
      );
    } catch (error) {
      this.logger.warn({
        message: 'Could not decide whether a bot should dream',
        turnId: turn.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
