import { renderHook } from '@testing-library/react';
import i18next from 'i18next';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../modules/core';
import { useErrorMessage } from '../error-message';

/** What the host step's pairing call rejected with on the dev deployment. */
const hostsFailure = () =>
  new AppError(
    { code: 'HOSTS_004', message: '' },
    {
      status: 409,
      problem: { type: 'about:blank', title: 'Conflict', status: 409, code: 'HOSTS_004' },
    },
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useErrorMessage', () => {
  // Regression: onboarding's host step crashed to the route error screen with
  // "TypeError: n.exists is not a function" when react-i18next had no i18next
  // instance to hand back (two installed copies; the app initialised the other
  // one). The error boundary replaced the whole step, including its "Skip"
  // link, which exists for exactly this failure.
  it('falls back to the generic message instead of throwing when there is no i18next instance', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useErrorMessage());

    // react-i18next's fallback `t` echoes the key, so the generic message
    // surfaces as its key: what matters is that it is not the per-code one.
    expect(result.current(hostsFailure())).toMatchObject({
      message: 'errors.fallback',
      code: 'HOSTS_004',
    });
    expect(result.current(hostsFailure(), 'Could not pair the host.').message).toBe(
      'Could not pair the host.',
    );

    // Loud in dev, but once: not one line per rendered failure.
    const reports = consoleError.mock.calls.filter(([line]) =>
      String(line).includes('useErrorMessage'),
    );
    expect(reports).toHaveLength(1);
    expect(String(reports[0]?.[0])).toMatch(/initReactI18next|more than one copy of/);
  });

  it('translates a known code and gives an unknown one the generic message', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({
      lng: 'en',
      resources: {
        en: {
          translation: {
            errors: {
              fallback: 'Something went wrong.',
              unreachable: 'Could not reach the server.',
              byCode: { HOSTS_004: 'That host is already paired.' },
            },
          },
        },
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    );

    const { result } = renderHook(() => useErrorMessage(), { wrapper });

    expect(result.current(hostsFailure()).message).toBe('That host is already paired.');
    const unknown = new AppError({ code: 'NOPE_999', message: '' }, { status: 500 });
    expect(result.current(unknown).message).toBe('Something went wrong.');
  });
});
