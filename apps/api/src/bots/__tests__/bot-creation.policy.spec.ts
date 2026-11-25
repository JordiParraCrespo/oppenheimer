import { BOT_PERMISSIONS, type BotPermission } from '@oppenheimer/shared';
import { permissionForBotMadeBy } from '../domain/bot-creation.policy';

/**
 * "No looser permissions than its own": the whole decision table of the level a
 * bot gets when another bot creates it. A regression here hands a bot under
 * Ask for approval a way to mint one whose asking calls run without the
 * person.
 */
describe('permissionForBotMadeBy', () => {
  it.each<[BotPermission, BotPermission | undefined, BotPermission]>([
    // Nothing asked: the creator's level, or the console's default when stricter.
    ['ask', undefined, 'ask'],
    ['auto', undefined, 'auto'],
    ['full', undefined, 'auto'],
    // Asked for no looser than the creator's: granted.
    ['ask', 'ask', 'ask'],
    ['auto', 'ask', 'ask'],
    ['auto', 'auto', 'auto'],
    ['full', 'auto', 'auto'],
    ['full', 'full', 'full'],
  ])('a creator on %s asking for %s gets %s', (creator, requested, expected) => {
    expect(permissionForBotMadeBy(creator, requested)).toEqual({ permission: expected });
  });

  it.each<[BotPermission, BotPermission]>([
    ['ask', 'auto'],
    ['ask', 'full'],
    ['auto', 'full'],
  ])('refuses a bot made by one on %s a looser %s, naming the ceiling', (creator, requested) => {
    expect(permissionForBotMadeBy(creator, requested)).toEqual({
      refused: true,
      ceiling: creator,
    });
  });

  it('reads the levels in the catalog’s order, strictest first', () => {
    // The policy ranks by this order: a level added out of place would loosen the ceiling.
    expect(BOT_PERMISSIONS).toEqual(['ask', 'auto', 'full']);
  });
});
