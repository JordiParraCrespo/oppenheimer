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
    provider: 'anthropic',
    ...overrides,
  });

describe('BotEntity', () => {
  it('is born blank: its provider’s default model, approve-for-me, learning on, placed last', () => {
    const bot = newBot();
    expect(bot).toMatchObject({
      model: null,
      effort: null,
      permission: 'auto',
      learnAutomatically: true,
      placement: 'last',
    });
  });

  it('remembers which columns an edit set, so a write stores those alone', () => {
    const bot = BotEntity.create({ id: randomUUID(), props: { ...newBot().getProps() } });
    expect([...bot.editedFields]).toEqual([]);
    bot.edit({ avatarColor: 'coral' });
    expect([...bot.editedFields]).toEqual(['avatarColor']);
    bot.edit({ model: 'claude-opus-5-5' });
    // A new model can unset an effort it does not offer, so the effort is written with it.
    expect([...bot.editedFields].sort()).toEqual(['avatarColor', 'effort', 'model']);
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

  it('refuses a model its provider does not offer', () => {
    expect(() => newBot().edit({ model: 'gpt-5.6-sol' })).toThrow();
    expect(() => newBot({ provider: 'glm' }).edit({ model: 'claude-opus-5-5' })).toThrow();
  });

  it('runs the new provider’s default model, with no effort, when only the provider changes', () => {
    const bot = newBot();
    bot.edit({ model: 'claude-opus-5-5', effort: 'high' });
    bot.edit({ provider: 'openai' });
    expect(bot).toMatchObject({ provider: 'openai', model: null, effort: null });
    expect([...bot.editedFields]).toEqual(expect.arrayContaining(['provider', 'model', 'effort']));
  });

  it('takes a provider and one of its models in one edit', () => {
    const bot = newBot();
    bot.edit({ provider: 'openai', model: 'gpt-5.6-terra', effort: 'high' });
    expect(bot).toMatchObject({ provider: 'openai', model: 'gpt-5.6-terra', effort: 'high' });
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
