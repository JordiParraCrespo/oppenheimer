import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { BotGroupEntity } from '../domain/bot-group.entity';

/** `name-taken`: another group of the workspace has that name, whatever its case. */
export type BotGroupWriteOutcome = 'saved' | 'name-taken' | 'missing';

export interface BotGroupRepositoryPort {
  /** The workspace's groups in sidebar order. */
  findAll(scope: AccessScope): Promise<BotGroupEntity[]>;
  findOneById(scope: AccessScope, id: string): Promise<Option<BotGroupEntity>>;
  /** The group, last in the sidebar. */
  insert(group: BotGroupEntity): Promise<BotGroupWriteOutcome>;
  /** The name, and the sidebar's order when the group moved. */
  save(group: BotGroupEntity): Promise<BotGroupWriteOutcome>;
  /** The group; its bots move, ungrouped, to the end of the ungrouped list. */
  delete(group: BotGroupEntity): Promise<void>;
}
