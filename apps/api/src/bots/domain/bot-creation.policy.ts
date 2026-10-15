import { ArgumentInvalidException } from '@oppenheimer/backend-ddd';
import { BOT_PERMISSIONS, type BotPermission } from '@oppenheimer/shared';

/** The level a bot made in the console starts at: Approve for me. */
export const BOT_DEFAULT_PERMISSION: BotPermission = 'auto';

/**
 * How loose a level is: its place in `BOT_PERMISSIONS`, which lists them
 * from the strictest (`auto`, Approve for me: what reaches outside
 * Oppenheimer asks) to the loosest (`full`, Full access: nothing asks).
 */
function loosenessOf(permission: BotPermission): number {
  return BOT_PERMISSIONS.indexOf(permission);
}

/** The stricter of two levels. */
function stricterPermission(a: BotPermission, b: BotPermission): BotPermission {
  return loosenessOf(a) <= loosenessOf(b) ? a : b;
}

/**
 * The level of a bot another bot creates (`25-bots.md` §4.6: "no looser
 * permissions than its own"). The one asked for, when it is no looser than
 * the creator's; none asked for is the creator's, or the console's default
 * when that is stricter. A looser one is refused, naming the ceiling, so the
 * caller says why rather than quietly getting less than it asked for.
 */
export function permissionForBotMadeBy(
  creator: BotPermission,
  requested: BotPermission | undefined,
): { permission: BotPermission } | { refused: true; ceiling: BotPermission } {
  if (requested === undefined) {
    return { permission: stricterPermission(creator, BOT_DEFAULT_PERMISSION) };
  }
  if (loosenessOf(requested) > loosenessOf(creator)) return { refused: true, ceiling: creator };
  return { permission: requested };
}

/** A level looser than the creating bot's, or one it no longer holds by the time of the write. */
export class BotLooserThanCreatorException extends ArgumentInvalidException {
  constructor() {
    super('A bot cannot create a bot looser than its own level');
  }
}
