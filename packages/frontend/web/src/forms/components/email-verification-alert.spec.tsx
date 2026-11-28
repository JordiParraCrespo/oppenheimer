import { AppError, type OppenheimerApp } from '@oppenheimer/frontend-core';
import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorAlert } from './error-alert';

/**
 * The refusal every credential-issuing screen can get (`TOKEN_010`: an API
 * token, a host pairing token, a webhook URL, an OAuth grant) drawn through
 * `ErrorAlert` with its way out, a new verification link. The request itself
 * is `AuthService.sendVerificationEmail`'s spec.
 */
vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (key: string, options?: { email?: string }) =>
      options?.email ? `${key} ${options.email}` : key,
    i18n: { exists: (key: string) => key === 'errors.byCode.TOKEN_010', t: (key: string) => key },
  }),
}));

afterEach(cleanup);

const unverified = () =>
  new AppError(
    { code: 'HOSTS_CLIENT_001', message: 'Could not mint' },
    {
      status: 403,
      problem: { type: 'about:blank', title: 'Forbidden', status: 403, code: 'TOKEN_010' },
    },
  );

function show(sendVerificationEmail: () => Promise<string>, error: unknown = unverified()) {
  const app = { auth: { sendVerificationEmail } } as unknown as OppenheimerApp;
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OppenheimerProvider app={app}>
        <ErrorAlert error={error} fallback="Could not create the install command" />
      </OppenheimerProvider>
    </QueryClientProvider>,
  );
}

const resendButton = () => screen.getByRole('button', { name: 'auth.verifyEmail.resend' });

describe('ErrorAlert for an unverified address', () => {
  // Regression: the first link expires after an hour, and the console offered
  // no other, so an account that missed it could never pair a host or mint a
  // token.
  it('keeps the refusal and offers a new link, then says where it went', async () => {
    const send = vi.fn().mockResolvedValue('ada@example.com');
    show(send);

    expect(screen.getByRole('alert').textContent).toContain('errors.byCode.TOKEN_010');
    expect(screen.queryByRole('button', { name: 'common.dismiss' })).toBeNull();
    await act(async () => fireEvent.click(resendButton()));

    expect(send).toHaveBeenCalledOnce();
    expect((await screen.findByRole('status')).textContent).toBe(
      'auth.verifyEmail.sent ada@example.com',
    );
    expect(screen.queryByRole('button', { name: 'auth.verifyEmail.resend' })).toBeNull();
  });

  it('sends once for a double click while the first request is in flight', async () => {
    let answer: (email: string) => void = () => {};
    const send = vi.fn(() => new Promise<string>((resolve) => (answer = resolve)));
    show(send);

    fireEvent.click(resendButton());
    const pending = await screen.findByRole('button', { name: 'auth.verifyEmail.sending' });
    expect(pending.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(pending);
    await act(async () => answer('ada@example.com'));

    expect(send).toHaveBeenCalledOnce();
  });

  // A failure drawn as success is the bug: the person would wait for an
  // email that never left.
  it('says the send failed and leaves the button to try again', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new AppError({ code: '', message: '' }, { status: 500 }))
      .mockResolvedValueOnce('ada@example.com');
    show(send);

    await act(async () => fireEvent.click(resendButton()));
    expect(await screen.findByText('auth.verifyEmail.failed')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();

    await act(async () => fireEvent.click(resendButton()));
    expect(send).toHaveBeenCalledTimes(2);
    expect((await screen.findByRole('status')).textContent).toContain('ada@example.com');
  });

  it('leaves every other refusal to the ordinary alert', () => {
    show(vi.fn(), new AppError({ code: 'HOSTS_004', message: 'Not configured' }));

    expect(screen.queryByRole('button', { name: 'auth.verifyEmail.resend' })).toBeNull();
    expect(screen.getByRole('button', { name: 'common.dismiss' })).toBeTruthy();
  });
});
