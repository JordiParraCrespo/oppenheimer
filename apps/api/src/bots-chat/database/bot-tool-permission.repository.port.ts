import type { AccessScope } from '@oppenheimer/backend-authz';
import type { BotToolPermissionEntity } from '../domain/bot-tool-permission.entity';

export interface BotToolPermissionRepositoryPort {
  /** A bot's settings and grants, newest first, as its owner's workspace reads them. */
  findAll(scope: AccessScope, botId: string): Promise<BotToolPermissionEntity[]>;
  /** The same, for a turn the worker runs in the bot's workspace. */
  findAllForTurn(organizationId: string, botId: string): Promise<BotToolPermissionEntity[]>;
  /** The tool's own decision, replacing the one it had. `missing` when the bot is gone. */
  setDecision(permission: BotToolPermissionEntity): Promise<'saved' | 'missing'>;
  /** Drops the tool's own decision: it follows the preset again. */
  clearDecision(organizationId: string, botId: string, tool: string): Promise<void>;
  /**
   * A standing grant, unless the bot already holds `max`: counted under a
   * lock on the bot. One that exists already is kept (`exists`).
   */
  insertGrant(
    grant: BotToolPermissionEntity,
    max: number,
  ): Promise<'inserted' | 'exists' | 'full' | 'missing'>;
  /** Removes one grant; whether there was one to remove. */
  deleteGrant(scope: AccessScope, botId: string, grantId: string): Promise<boolean>;
}
