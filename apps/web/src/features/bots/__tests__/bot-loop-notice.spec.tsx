import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotLoopNotice } from '../sections/bot-loop-notice';

/**
 * The loop over a bot's composer (`25-bots.md` §4.1, `/loop`). What breaks
 * this: Stop ending another bot's loop, a self-paced loop drawn as if a run
 * were due, or a Stop that failed going unsaid.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      [key, ...Object.values(values ?? {})].join('|'),
    i18n: { resolvedLanguage: 'en', language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const state = vi.hoisted(() => ({ mutate: vi.fn(), isError: false }));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useClearBotLoop: () => ({ mutate: state.mutate, isPending: false, isError: state.isError }),
}));

afterEach(() => {
  cleanup();
  state.isError = false;
});

const loop = {
  id: 'loop-1',
  prompt: 'check the deploy',
  intervalMinutes: 5,
  runs: 3,
  nextRunAt: '2026-11-03T10:05:00Z',
  expiresAt: '2026-11-06T10:00:00Z',
  createdAt: '2026-11-03T10:00:00Z',
};

describe('BotLoopNotice', () => {
  it('says the loop, how often it runs and when next, and stops this bot’s loop', () => {
    render(<BotLoopNotice botId="bot-1" loop={loop} />);
    expect(screen.getByText('bots.chat.loop.title|check the deploy')).toBeTruthy();
    expect(
      screen.getByText(/bots\.chat\.loop\.every\.minutes\|5 · bots\.chat\.loop\.next/),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'bots.chat.loop.stop' }));
    expect(state.mutate).toHaveBeenCalledWith({ id: 'bot-1' });
  });

  it('says a self-paced loop waits for the bot to say when', () => {
    render(
      <BotLoopNotice botId="bot-1" loop={{ ...loop, intervalMinutes: null, nextRunAt: null }} />,
    );
    expect(
      screen.getByText(/bots\.chat\.loop\.every\.selfPaced.*bots\.chat\.loop\.deciding/),
    ).toBeTruthy();
  });

  it('says a Stop that failed where it was pressed', () => {
    state.isError = true;
    render(<BotLoopNotice botId="bot-1" loop={loop} />);
    expect(screen.getByText('bots.chat.loop.stopFailed')).toBeTruthy();
  });
});
