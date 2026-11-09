import type { BotGoal } from '@oppenheimer/shared/schemas/bot';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotGoalNotice } from '../sections/bot-goal-notice';

/**
 * The goal over a bot's composer. What breaks this: Stop clearing another
 * bot's goal, the notice losing the count of continuations taken, a goal
 * held for a rate limit looking stalled because the notice does not say so,
 * or a paused goal with no way to resume it from where it shows.
 */

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      [key, ...Object.values(values ?? {})].join('|'),
    i18n: { resolvedLanguage: 'en' },
  }),
}));

const state = vi.hoisted(() => ({ mutate: vi.fn(), resume: vi.fn(), isError: false }));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useClearBotGoal: () => ({ mutate: state.mutate, isPending: false, isError: state.isError }),
  useResumeBotGoal: () => ({ mutate: state.resume, isPending: false, isError: false }),
}));

afterEach(() => {
  cleanup();
  state.isError = false;
});

const goal: BotGoal = {
  id: 'goal-1',
  objective: 'Get the release branch green',
  continuations: 2,
  limit: null,
  tokensUsed: 0,
  tokenBudget: null,
  paused: null,
  createdAt: '2026-10-29T10:00:00Z',
  waiting: null,
};

describe('BotGoalNotice', () => {
  it('says the goal and how many continuations it has taken, and stops this bot’s goal', () => {
    render(<BotGoalNotice botId="bot-1" goal={goal} />);
    expect(screen.getByText('bots.chat.goal.title|Get the release branch green')).toBeTruthy();
    expect(screen.getByText('bots.chat.goal.continuations|2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'bots.chat.goal.stop' }));
    expect(state.mutate).toHaveBeenCalledWith({ id: 'bot-1' });
  });

  it('says what a goal held for a rate limit waits for, and until when, in place of the count', () => {
    render(
      <BotGoalNotice
        botId="bot-1"
        goal={{ ...goal, waiting: { system: 'Gmail', until: '2026-11-03T10:02:00.000Z' } }}
      />,
    );
    const line = screen.getByText(/^bots\.chat\.goal\.waiting\|Gmail\|/);
    expect(line.textContent).toMatch(/\d{1,2}:02/);
    expect(screen.queryByText('bots.chat.goal.continuations|2')).toBeNull();
  });

  it('counts a goal set with a limit against it, and says what a budget has spent', () => {
    render(<BotGoalNotice botId="bot-1" goal={{ ...goal, limit: 5 }} />);
    expect(screen.getByText('bots.chat.goal.progress|2|5')).toBeTruthy();
    cleanup();
    render(
      <BotGoalNotice botId="bot-1" goal={{ ...goal, tokensUsed: 1_500, tokenBudget: 1_000_000 }} />,
    );
    expect(
      screen.getByText(/^bots\.chat\.goal\.budget\|bots\.chat\.goal\.continuations\|2\|/),
    ).toBeTruthy();
  });

  it('says why a paused goal paused, and resumes this bot’s goal', () => {
    const paused = {
      ...goal,
      paused: { reason: 'no_progress' as const, note: null, at: '2026-11-09T10:00:00Z' },
    };
    render(<BotGoalNotice botId="bot-1" goal={paused} />);
    expect(screen.getByText('bots.chat.goal.paused.no_progress')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'bots.chat.goal.resume' }));
    expect(state.resume).toHaveBeenCalledWith({ id: 'bot-1' });
    expect(screen.getByRole('button', { name: 'bots.chat.goal.stop' })).toBeTruthy();
  });

  it('says a Stop that failed where it was pressed', () => {
    state.isError = true;
    render(<BotGoalNotice botId="bot-1" goal={goal} />);
    expect(screen.getByText('bots.chat.goal.stopFailed')).toBeTruthy();
  });
});
