import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { BotMemoryFactEntity } from '../domain/bot-memory-fact.entity';

export interface BotMemoryFactRepositoryPort {
  /** A bot's facts, newest first. */
  findAll(scope: AccessScope, botId: string): Promise<BotMemoryFactEntity[]>;
  findOneById(
    scope: AccessScope,
    botId: string,
    factId: string,
  ): Promise<Option<BotMemoryFactEntity>>;
  /**
   * The fact, unless the bot already keeps `max`: counted under a lock on the
   * bot's row, so two adds at once cannot both take the last place. `missing`
   * when the bot is gone.
   */
  insert(fact: BotMemoryFactEntity, max: number): Promise<'inserted' | 'full' | 'missing'>;
  save(fact: BotMemoryFactEntity): Promise<'saved' | 'missing'>;
  delete(fact: BotMemoryFactEntity): Promise<void>;
  /** Every fact of the bot. */
  clear(bot: { organizationId: string; id: string }): Promise<void>;
}
