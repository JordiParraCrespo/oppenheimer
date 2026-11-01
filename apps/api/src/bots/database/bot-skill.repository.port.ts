import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { BotSkillEntity } from '../domain/bot-skill.entity';

export interface BotSkillRepositoryPort {
  /** A bot's skills, by name. */
  findAll(scope: AccessScope, botId: string): Promise<BotSkillEntity[]>;
  /** The same, for a turn the worker runs in the bot's workspace. */
  findAllForTurn(organizationId: string, botId: string): Promise<BotSkillEntity[]>;
  findOneById(scope: AccessScope, botId: string, skillId: string): Promise<Option<BotSkillEntity>>;
  findOneByName(scope: AccessScope, botId: string, name: string): Promise<Option<BotSkillEntity>>;
  /**
   * The skill, unless the bot already keeps `max` (counted under a lock on the
   * bot's row, so two adds at once cannot both take the last place) or has one
   * of that name. `missing` when the bot is gone.
   */
  insert(skill: BotSkillEntity, max: number): Promise<'inserted' | 'full' | 'taken' | 'missing'>;
  /** `taken` when a rename meets another skill's name. */
  save(skill: BotSkillEntity): Promise<'saved' | 'taken' | 'missing'>;
  delete(skill: BotSkillEntity): Promise<void>;
}
