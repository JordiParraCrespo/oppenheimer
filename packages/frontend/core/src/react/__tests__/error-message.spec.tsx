import { renderHook } from '@testing-library/react';
import i18next from 'i18next';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../modules/core';
import { useErrorMessage } from '../error-message';

const failure = (code: string) => new AppError({ code, message: '' }, { status: 503 });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useErrorMessage', () => {
  it('falls back to the generic message instead of throwing when there is no i18next instance', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useErrorMessage());

    // react-i18next's fallback `t` echoes the key, so the generic message
    // surfaces as its key: what matters is that it is not the per-code one.
    expect(result.current(failure('HOSTS_004'))).toMatchObject({
      message: 'errors.fallback',
      code: 'HOSTS_004',
    });
    expect(result.current(failure('HOSTS_004'), 'Could not pair the host.').message).toBe(
      'Could not pair the host.',
    );
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

    expect(result.current(failure('HOSTS_004')).message).toBe('That host is already paired.');
    expect(result.current(failure('NOPE_999')).message).toBe('Something went wrong.');
  });
});
