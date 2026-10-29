import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotQuestionCard } from '../sections/bot-question-card';

/**
 * A bot's card of questions. What breaks this: a card drawn when nothing
 * waits; answers or a dismissal sent to another card, or through the
 * approval decision (a card of questions is never approved).
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const state = vi.hoisted(() => ({
  card: null as null | { id: string; questions: { question: string }[] },
  answer: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useBotPendingQuestion: () => ({ data: state.card, refetch: vi.fn() }),
  useAnswerBotQuestion: () => ({ mutate: state.answer, error: null, reset: vi.fn() }),
  useDismissBotQuestion: () => ({ mutate: state.dismiss, error: null, reset: vi.fn() }),
}));

vi.mock('@oppenheimer/frontend-web', () => ({
  ErrorAlert: () => null,
  // The picker is the kit's, with its own spec; this one is how the card wires it.
  ChatQuestionPicker: ({
    questions,
    onAnswer,
    onDismiss,
  }: {
    questions: { question: string }[];
    onAnswer: (answers: { picks: number[]; other: string | null }[]) => boolean;
    onDismiss: () => void;
  }) => (
    <div>
      {questions.map((question) => (
        <p key={question.question}>{question.question}</p>
      ))}
      <button type="button" onClick={() => onAnswer([{ picks: [1], other: 'and tag it' }])}>
        answer
      </button>
      <button type="button" onClick={onDismiss}>
        dismiss
      </button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  state.card = null;
  state.answer.mockReset();
  state.dismiss.mockReset();
});

describe('BotQuestionCard', () => {
  it('draws nothing while no card of questions waits', () => {
    const { container } = render(<BotQuestionCard botId="bot-1" />);
    expect(container.innerHTML).toBe('');
  });

  it('sends the answers, or a dismissal, to this card', () => {
    state.card = { id: 'q-2', questions: [{ question: 'Which repository?' }] };
    render(<BotQuestionCard botId="bot-1" />);
    expect(screen.getByText('Which repository?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'answer' }));
    expect(state.answer).toHaveBeenLastCalledWith({
      id: 'bot-1',
      questionId: 'q-2',
      answers: [{ picks: [1], other: 'and tag it' }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'dismiss' }));
    expect(state.dismiss).toHaveBeenLastCalledWith({ id: 'bot-1', questionId: 'q-2' });
  });
});
