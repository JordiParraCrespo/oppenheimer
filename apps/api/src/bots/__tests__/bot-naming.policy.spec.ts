import { BOT_AVATAR_COLORS, BOT_NAME_MAX } from '@oppenheimer/shared';
import {
  avatarColorFor,
  BOT_FIRST_NAMES,
  firstNameFor,
  uniqueBotName,
} from '../domain/bot-naming.policy';

/**
 * What a new bot is called and drawn on (`product/versions/mvp/25-bots.md`
 * §2): a name the workspace does not have yet, and the next colour. The
 * create handler's spec covers that it asks; this is the whole rule.
 */
describe('firstNameFor', () => {
  it('walks the first names in order as a workspace makes bots', () => {
    expect(firstNameFor([])).toBe(BOT_FIRST_NAMES[0]);
    expect(firstNameFor(['Release manager'])).toBe(BOT_FIRST_NAMES[1]);
  });

  it('skips a name the workspace already has, compared without case', () => {
    expect(firstNameFor(['x', ` ${BOT_FIRST_NAMES[2].toUpperCase()} `])).toBe(BOT_FIRST_NAMES[3]);
  });

  it('numbers a name once every first name is taken', () => {
    expect(firstNameFor([...BOT_FIRST_NAMES])).toBe(`${BOT_FIRST_NAMES[0]} 2`);
  });

  it('gives every first name its own initial, so avatars in a sidebar differ', () => {
    const initials = BOT_FIRST_NAMES.map((name) => name[0]);
    expect(new Set(initials).size).toBe(BOT_FIRST_NAMES.length);
  });
});

describe('uniqueBotName', () => {
  it('keeps a name the workspace does not have', () => {
    expect(uniqueBotName('New Bot', ['Release manager'])).toBe('New Bot');
  });

  it('numbers a taken name from 2, skipping numbers already used', () => {
    expect(uniqueBotName('New Bot', ['New Bot'])).toBe('New Bot 2');
    expect(uniqueBotName('New Bot', ['New Bot', 'New Bot 2', 'New Bot 4'])).toBe('New Bot 3');
  });

  it('compares names without case or surrounding spaces, as a person reads the sidebar', () => {
    expect(uniqueBotName('new bot', [' New Bot '])).toBe('new bot 2');
  });

  it('shortens a long name so the number still fits the column', () => {
    const long = 'x'.repeat(BOT_NAME_MAX);
    const named = uniqueBotName(long, [long]);
    expect(named).toHaveLength(BOT_NAME_MAX);
    expect(named.endsWith(' 2')).toBe(true);
  });
});

describe('avatarColorFor', () => {
  it('walks the eight colours in order and starts over', () => {
    expect(avatarColorFor(0)).toBe(BOT_AVATAR_COLORS[0]);
    expect(avatarColorFor(1)).toBe(BOT_AVATAR_COLORS[1]);
    expect(avatarColorFor(BOT_AVATAR_COLORS.length)).toBe(BOT_AVATAR_COLORS[0]);
  });
});
