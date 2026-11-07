import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { BotMemoryFactEntity } from '../domain/bot-memory-fact.entity';

export interface BotMemoryFactRepositoryPort {
  /**
   * A bot's facts and the `person` facts its owner's other bots keep, newest
   * first; a shared fact names the bot that keeps it (`botId`).
   */
  findAll(scope: AccessScope, botId: string): Promise<BotMemoryFactEntity[]>;
  /**
   * Every `person` fact the caller's own bots keep about them, newest first:
   * Settings → Memory, where each is changed on the bot that keeps it.
   */
  findAboutPerson(scope: AccessScope): Promise<BotMemoryFactEntity[]>;
  /** The same, for a turn the worker runs in the bot's workspace. */
  findAllForTurn(organizationId: string, botId: string): Promise<BotMemoryFactEntity[]>;
  /** One of the bot's own facts; a fact shared by another bot is that bot's to change. */
  findOneById(
    scope: AccessScope,
    botId: string,
    factId: string,
  ): Promise<Option<BotMemoryFactEntity>>;
  /**
   * The fact, unless the bot already keeps `max`: counted under a lock on the
   * bot's row, so two adds at once cannot both take the last place. With
   * `makeRoom`, a full memory deletes the bot's oldest `log` fact first, and
   * is `full` only when it keeps none. `missing` when the bot is gone.
   */
  insert(
    fact: BotMemoryFactEntity,
    max: number,
    makeRoom?: boolean,
  ): Promise<'inserted' | 'full' | 'missing'>;
  save(fact: BotMemoryFactEntity): Promise<'saved' | 'missing'>;
  delete(fact: BotMemoryFactEntity): Promise<void>;
  /** Every fact of the bot. */
  clear(bot: { organizationId: string; id: string }): Promise<void>;
}
