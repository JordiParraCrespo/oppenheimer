import { AppError } from '@oppenheimer/frontend-core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorAlert } from './error-alert';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { id?: string }) => (options?.id ? `${key} ${options.id}` : key),
    i18n: { exists: () => false, t: (key: string) => key },
  }),
}));

afterEach(cleanup);

const refused = (correlationId?: string) =>
  new AppError(
    { code: 'SESSIONS_001', message: 'Refused' },
    {
      status: 409,
      problem: { type: 'about:blank', title: 'Conflict', status: 409, correlationId },
    },
  );

describe('ErrorAlert', () => {
  it('renders nothing without an error', () => {
    const { container } = render(<ErrorAlert error={null} fallback="Could not delete" />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the fallback for a failure with no translated code', () => {
    render(<ErrorAlert error={refused()} fallback="Could not delete" />);
    expect(screen.getByRole('alert').textContent).toContain('Could not delete');
    expect(screen.queryByText(/errors\.correlationId/)).toBeNull();
  });

  it('shows the correlation id when the server sent one', () => {
    render(<ErrorAlert error={refused('req-42')} fallback="Could not delete" />);
    expect(screen.getByText('errors.correlationId req-42')).toBeTruthy();
  });

  it('names what failed when given a title', () => {
    render(<ErrorAlert error={refused()} fallback="Could not pause" title="Nightly triage" />);
    expect(screen.getByRole('alert').textContent).toContain('Nightly triage');
  });

  it('hands the dismiss to the caller when it clears the failure', () => {
    const onDismiss = vi.fn();
    render(<ErrorAlert error={refused()} fallback="Could not delete" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'common.dismiss' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  // Regression: a failure the caller never clears (a list's load error) left
  // the reader no way to close the alert.
  it('closes on its own when the caller gives no dismiss, until a new failure', () => {
    const first = refused();
    const { rerender } = render(<ErrorAlert error={first} fallback="Could not load" />);
    fireEvent.click(screen.getByRole('button', { name: 'common.dismiss' }));
    expect(screen.queryByRole('alert')).toBeNull();

    rerender(<ErrorAlert error={first} fallback="Could not load" />);
    expect(screen.queryByRole('alert')).toBeNull();

    rerender(<ErrorAlert error={refused()} fallback="Could not load" />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});

describe('ErrorAlert with a resolved message', () => {
  it('draws a sentence a form already resolved, with its reference', () => {
    render(<ErrorAlert message="That name is taken" correlationId="req-7" />);
    expect(screen.getByRole('alert').textContent).toContain('That name is taken');
    expect(screen.getByText('errors.correlationId req-7')).toBeTruthy();
  });

  it('renders nothing for an empty message', () => {
    const { container } = render(<ErrorAlert message={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('takes the caller’s action instead of Dismiss', () => {
    render(<ErrorAlert message="Refused" action={<button type="button">Retry</button>} />);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});
