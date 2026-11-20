import { BotEntity } from '@oppenheimer/frontend-consumer';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBotRowItem } from '../hooks/use-bot-row-item';
import { useBotUnread, useClearBotUnreadOnOpen } from '../hooks/use-bot-unread';

/**
 * A bot's sidebar row reads as a session's: one state, first match wins.
 * Waiting on you (a card pending, a failed turn unread) is the amber dot and
 * hides the shimmer; working shimmers the name; a reply you have not read, or
 * the reader's own unread mark, is the blue dot, which no working bot shows.
 * The mark is kept on this device and opening the chat takes it off.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const activity = vi.hoisted(() => ({ working: false, waiting: false }));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useBotWorking: () => activity.working,
  useBotWaitingOnYou: () => activity.waiting,
}));

afterEach(() => {
  activity.working = false;
  activity.waiting = false;
  window.localStorage.clear();
});

function bot(unread: boolean): BotEntity {
  const at = new Date('2026-11-20T09:00:00Z');
  return new BotEntity(
    'b1',
    'Release Bot',
    'Ships releases',
    'mint',
    null,
    0,
    null,
    'anthropic',
    null,
    null,
    'auto',
    true,
    at,
    at,
    at,
    'Shipped.',
    [],
    null,
    unread,
  );
}

const state = (unread: boolean) => {
  const { result } = renderHook(() => useBotRowItem(bot(unread)));
  const { needsInput, working, unread: blue } = result.current;
  return { needsInput, working, unread: blue };
};

describe('a bot row’s state', () => {
  it('shows a reply you have not read as the blue dot, and nothing once read', () => {
    expect(state(true)).toEqual({ needsInput: false, working: false, unread: true });
    expect(state(false)).toEqual({ needsInput: false, working: false, unread: false });
  });

  it('shimmers while working and holds the blue dot until the bot stops', () => {
    activity.working = true;
    expect(state(true)).toEqual({ needsInput: false, working: true, unread: false });
  });

  it('shows waiting on you as the amber dot alone, over working and unread', () => {
    activity.working = true;
    activity.waiting = true;
    expect(state(true)).toEqual({ needsInput: true, working: false, unread: false });
  });

  it('keeps the reader’s own unread mark across a reload until the chat is opened', () => {
    const menu = renderHook(() => useBotUnread('b1'));
    act(() => menu.result.current.setUnread(true));
    menu.unmount();
    expect(state(false).unread).toBe(true);

    renderHook(() => useClearBotUnreadOnOpen('b1'));
    expect(state(false).unread).toBe(false);
  });
});
