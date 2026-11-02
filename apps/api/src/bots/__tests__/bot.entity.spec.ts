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
    // The provider, model and effort are one setting, written together.
    expect([...bot.editedFields].sort()).toEqual(['avatarColor', 'effort', 'model', 'provider']);
  });

  it('applies the launch policy on a provider change and writes all three columns', () => {
    const bot = newBot();
    bot.edit({ model: 'claude-opus-5-5', effort: 'high' });
    bot.edit({ provider: 'openai' });
    expect(bot).toMatchObject({ provider: 'openai', model: null, effort: null });
    expect([...bot.editedFields]).toEqual(expect.arrayContaining(['provider', 'model', 'effort']));
  });

  it('shows in no section until named, and keeps a set of them in catalog order', () => {
    expect(newBot().sections).toEqual([]);
    expect(newBot({ sections: ['pulls', 'sessions'] }).sections).toEqual(['sessions', 'pulls']);
    const bot = BotEntity.create({ id: randomUUID(), props: { ...newBot().getProps() } });
    bot.edit({ sections: ['plan', 'automations', 'plan'] });
    expect(bot.sections).toEqual(['automations', 'plan']);
    expect([...bot.editedFields]).toEqual(['sections']);
  });

  it('refuses a section the console does not have rather than dropping it', () => {
    expect(() => newBot({ sections: ['inbox' as never] })).toThrow(
      'inbox is not a console section',
    );
    const bot = newBot({ sections: ['plan'] });
    expect(() => bot.edit({ sections: ['plan', 'inbox' as never] })).toThrow();
    expect(bot.sections).toEqual(['plan']);
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
