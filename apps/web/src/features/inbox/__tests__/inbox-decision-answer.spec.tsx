import type {
  SessionPermissionDecision,
  SessionQuestionDecision,
} from '@oppenheimer/shared/schemas/session-decision';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InboxPermissionAnswer } from '../components/inbox-permission-answer';
import { InboxQuestionAnswer } from '../components/inbox-question-answer';
import { type InboxAnswer, toAnswers } from '../lib/inbox-answer';

/**
 * A session's decision answered on its Inbox card (`29-inbox.md` slice 4).
 * What breaks this: Send answers enabled before every question has an
 * answer; a single choice sent with both a pick and words (the API refuses
 * it, `SESSIONS_033`); a permission answered by anything but the index of
 * the option pressed, in the dialog's own order.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { n?: number }) => (values?.n ? `${key}#${values.n}` : key),
  }),
}));

afterEach(cleanup);

const QUESTION: SessionQuestionDecision = {
  kind: 'question',
  id: 'toolu_1',
  questions: [
    {
      header: 'Scope',
      question: 'Which screens?',
      multiSelect: false,
      options: [
        { label: 'Wallet', description: null },
        { label: 'All', description: 'Every tab' },
      ],
    },
    {
      header: null,
      question: 'Which platforms?',
      multiSelect: true,
      options: [
        { label: 'iOS', description: null },
        { label: 'Android', description: null },
        { label: 'Web', description: null },
      ],
    },
  ],
};

function renderQuestion() {
  const onSend = vi.fn<(answers: InboxAnswer[]) => void>();
  render(
    <InboxQuestionAnswer
      decision={QUESTION}
      pending={false}
      onSend={onSend}
      alert={null}
      leading={null}
    />,
  );
  const send = screen.getByRole('button', { name: 'inbox.session.send' }) as HTMLButtonElement;
  return { onSend, send };
}

const option = (label: string) => screen.getByRole('button', { name: label });

describe('InboxQuestionAnswer', () => {
  it('sends only once every question has an answer, picks and words as given', () => {
    const { onSend, send } = renderQuestion();
    expect(send.disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /^All/ }));
    expect(send.disabled).toBe(true);

    fireEvent.click(option('iOS'));
    fireEvent.click(option('Web'));
    fireEvent.change(screen.getByLabelText('inbox.session.otherLabel#2'), {
      target: { value: '  Linux ' },
    });
    expect(send.disabled).toBe(false);

    fireEvent.click(send);
    const [answers] = onSend.mock.calls[0] ?? [];
    expect(toAnswers(answers ?? [])).toEqual([
      { picks: [1], other: null },
      { picks: [0, 2], other: 'Linux' },
    ]);
  });

  it('lets words replace the pick of a single choice, and a pick replace the words', () => {
    const { onSend, send } = renderQuestion();
    fireEvent.click(option('Wallet'));
    const own = screen.getByLabelText('inbox.session.otherLabel#1');
    fireEvent.change(own, { target: { value: 'Only settings' } });
    expect(option('Wallet').getAttribute('aria-pressed')).toBe('false');

    fireEvent.change(screen.getByLabelText('inbox.session.otherLabel#2'), {
      target: { value: 'Linux' },
    });
    fireEvent.click(send);
    expect(toAnswers(onSend.mock.calls[0]?.[0] ?? [])[0]).toEqual({
      picks: [],
      other: 'Only settings',
    });

    fireEvent.click(option('Wallet'));
    expect((own as HTMLInputElement).value).toBe('');
  });
});

describe('InboxPermissionAnswer', () => {
  const PERMISSION: SessionPermissionDecision = {
    kind: 'permission',
    id: 'perm-a',
    title: 'Do you want to proceed?',
    detail: 'Bash command\n  pnpm generate:api-client',
    options: [
      { label: 'Yes' },
      { label: "Yes, and don't ask again for pnpm commands" },
      { label: 'No, and tell Claude what to do differently (esc)' },
    ],
  };

  it('shows the command and answers by the index of the option pressed, in screen order', () => {
    const onChoose = vi.fn();
    render(<InboxPermissionAnswer decision={PERMISSION} pending={false} onChoose={onChoose} />);
    expect(screen.getByText(/pnpm generate:api-client/)).toBeTruthy();
    const buttons = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttons).toEqual(PERMISSION.options.map((each) => each.label));

    fireEvent.click(option("Yes, and don't ask again for pnpm commands"));
    expect(onChoose).toHaveBeenCalledWith(1);
  });
});
