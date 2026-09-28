import { AppError } from '@oppenheimer/frontend-core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './confirm-dialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { exists: () => false, t: (key: string) => key },
  }),
}));

afterEach(cleanup);

const base = {
  title: 'Delete “Bump RN”?',
  description: 'The session stops.',
  confirmLabel: 'Delete session',
  pendingLabel: 'Deleting…',
  errorFallback: 'Could not delete the session',
  error: null,
  pending: false,
};

describe('ConfirmDialog', () => {
  it('confirms with the verb and cancels with Cancel', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<ConfirmDialog {...base} onConfirm={onConfirm} onClose={onClose} />);

    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete session' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('locks both buttons and reads the verb in progress while pending', () => {
    render(<ConfirmDialog {...base} pending onConfirm={vi.fn()} onClose={vi.fn()} />);

    const confirm = screen.getByRole('button', { name: 'Deleting…' });
    expect(confirm.hasAttribute('disabled')).toBe(true);
    expect(confirm.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('button', { name: 'common.cancel' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('keeps a failure in the dialog, beside its extra content', () => {
    const error = new AppError(
      { code: 'SESSIONS_001', message: 'Refused' },
      { status: 409, problem: { type: 'about:blank', title: 'Conflict', status: 409 } },
    );
    render(
      <ConfirmDialog {...base} error={error} onConfirm={vi.fn()} onClose={vi.fn()}>
        <label>
          <input type="checkbox" /> Discard unpushed work
        </label>
      </ConfirmDialog>,
    );

    expect(screen.getByRole('alert').textContent).toContain('Could not delete the session');
    expect(screen.getByLabelText('Discard unpushed work')).toBeTruthy();
  });

  it('submits the form it names instead of calling onConfirm', () => {
    const onConfirm = vi.fn();
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <ConfirmDialog {...base} form="typed" onConfirm={onConfirm} onClose={vi.fn()}>
        <form id="typed" onSubmit={onSubmit} />
      </ConfirmDialog>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete session' }));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
