import { randomUUID } from 'node:crypto';
import { BotEntity } from '../domain/bot.entity';

/**
 * A bot's launch settings and its place in the sidebar. The update handler's
 * spec covers the checks made through other modules; this is what the bot
 * itself holds true.
 */
const newBot = (overrides: Partial<Parameters<typeof BotEntity.createNew>[0]> = {}) =>
  BotEntity.createNew({
    organizationId: randomUUID(),
    createdByUserId: randomUUID(),
    name: 'New Bot',
    description: '',
    avatarColor: 'mint',
    groupId: null,
    homeHostId: null,
    ...overrides,
  });

describe('BotEntity', () => {
  it('is born blank: Claude Code’s default model, approve-for-me, learning on, placed last', () => {
    const bot = newBot();
    expect(bot).toMatchObject({
      model: null,
      effort: null,
      permission: 'auto',
      learnAutomatically: true,
      placement: 'last',
    });
  });

  it('records an effort the model offers, and none for one it does not', () => {
    const bot = newBot();
    bot.edit({ model: 'claude-opus-5-5', effort: 'high' });
    expect(bot.effort).toBe('high');
    bot.edit({ effort: 'ultra' });
    expect(bot.effort).toBeNull();
  });

  it('drops an effort the new model does not offer when only the model changes', () => {
    const bot = newBot();
    bot.edit({ model: 'claude-opus-5-5', effort: 'high' });
    bot.edit({ model: 'claude-haiku-4-5' });
    expect(bot.effort).toBeNull();
  });

  it('refuses a model Claude Code does not list', () => {
    expect(() => newBot().edit({ model: 'gpt-5' })).toThrow();
  });

  it('refuses a blank name', () => {
    expect(() => newBot().edit({ name: '   ' })).toThrow();
  });

  it('moves to another group last unless told where, and stays put when nothing moved', () => {
    const bot = newBot();
    bot.placed(0);
    bot.moveTo(null, undefined);
    expect(bot.placement).toBeNull();
    const group = randomUUID();
    bot.moveTo(group, undefined);
    expect(bot).toMatchObject({ groupId: group, placement: 'last' });
    bot.placed(4);
    bot.moveTo(group, 1);
    expect(bot.placement).toBe(1);
  });
});
