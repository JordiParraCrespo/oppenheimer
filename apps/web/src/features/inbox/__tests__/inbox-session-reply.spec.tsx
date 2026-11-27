import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionReplyForm } from '../forms/session-reply-form';

/**
 * A reply to a session left unattended, written on its Inbox card. What
 * breaks this: Enter that adds a line instead of sending, so the reader thinks
 * it went; Enter that sends while an IME is still composing a word, sending
 * half of it; a reply sent empty, which the API refuses; and a field cleared
 * by a send that then failed, losing what the reader wrote.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

afterEach(cleanup);

function renderForm() {
  const onSubmit = vi.fn();
  render(
    <SessionReplyForm id="reply" pending={false} onSubmit={onSubmit} alert={null} link={null} />,
  );
  return {
    onSubmit,
    field: screen.getByLabelText('inbox.unattended.replyLabel') as HTMLTextAreaElement,
  };
}

describe('SessionReplyForm', () => {
  it('sends the reply, trimmed, on Enter, and keeps it in the field', async () => {
    const { onSubmit, field } = renderForm();
    fireEvent.change(field, { target: { value: '  Now add the tests.\n' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ text: 'Now add the tests.' });
    // The card leaves on success; a failure must find the words still there.
    expect(field.value).toBe('  Now add the tests.\n');
  });

  it('does not send on Shift+Enter, nor on Enter while an IME is composing', async () => {
    const { onSubmit, field } = renderForm();
    fireEvent.change(field, { target: { value: 'テスト' } });
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
    fireEvent.keyDown(field, { key: 'Enter', isComposing: true });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sends nothing for an empty reply, and says so on the field', async () => {
    const { onSubmit, field } = renderForm();
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() => expect(field.getAttribute('aria-invalid')).toBe('true'));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
