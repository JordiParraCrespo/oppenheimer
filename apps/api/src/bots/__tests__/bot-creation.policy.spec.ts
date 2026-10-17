import { BOT_PERMISSIONS, type BotPermission } from '@oppenheimer/shared';
import { permissionForBotMadeBy } from '../domain/bot-creation.policy';

/**
 * "No looser permissions than its own" (`25-bots.md` §4.6): the whole
 * decision table of the level a bot gets when another bot creates it. A
 * regression here hands a bot under Approve for me a way to mint a Full
 * access one that runs its asking tools without the person.
 */
describe('permissionForBotMadeBy', () => {
  it.each<[BotPermission, BotPermission | undefined, BotPermission]>([
    // Nothing asked: the creator's level, or the console's default when stricter.
    ['auto', undefined, 'auto'],
    ['full', undefined, 'auto'],
    // Asked for no looser than the creator's: granted.
    ['auto', 'auto', 'auto'],
    ['full', 'auto', 'auto'],
    ['full', 'full', 'full'],
  ])('a creator on %s asking for %s gets %s', (creator, requested, expected) => {
    expect(permissionForBotMadeBy(creator, requested)).toEqual({ permission: expected });
  });

  it('refuses Full access to a bot made by one under Approve for me, naming the ceiling', () => {
    expect(permissionForBotMadeBy('auto', 'full')).toEqual({ refused: true, ceiling: 'auto' });
  });

  it('reads the levels in the catalog’s order, strictest first', () => {
    // The policy ranks by this order: a level added out of place would loosen the ceiling.
    expect(BOT_PERMISSIONS).toEqual(['auto', 'full']);
  });
});
