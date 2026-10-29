import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotGoalNotice } from '../sections/bot-goal-notice';

/**
 * The goal over a bot's composer. What breaks this: Stop clearing another
 * bot's goal, or the notice losing the count of continuations taken.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      [key, ...Object.values(values ?? {})].join('|'),
  }),
}));

const state = vi.hoisted(() => ({ mutate: vi.fn(), isError: false }));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useClearBotGoal: () => ({ mutate: state.mutate, isPending: false, isError: state.isError }),
}));

afterEach(cleanup);

const goal = {
  id: 'goal-1',
  objective: 'Get the release branch green',
  continuations: 2,
  limit: 5,
  createdAt: '2026-10-29T10:00:00Z',
};

describe('BotGoalNotice', () => {
  it('says the goal and how many continuations it has taken, and stops this bot’s goal', () => {
    render(<BotGoalNotice botId="bot-1" goal={goal} />);
    expect(screen.getByText('bots.chat.goal.title|Get the release branch green')).toBeTruthy();
    expect(screen.getByText('bots.chat.goal.progress|2|5')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'bots.chat.goal.stop' }));
    expect(state.mutate).toHaveBeenCalledWith({ id: 'bot-1' });
  });

  it('says a Stop that failed where it was pressed', () => {
    state.isError = true;
    render(<BotGoalNotice botId="bot-1" goal={goal} />);
    expect(screen.getByText('bots.chat.goal.stopFailed')).toBeTruthy();
  });
});
