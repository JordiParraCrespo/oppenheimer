import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { OppenheimerApp } from '../../di/oppenheimer-app';
import { OppenheimerProvider } from '../context';
import { userSettingsKeys, useUpdateUserSettings, useUserSettings } from '../user-settings.queries';

const SAVED = { userId: 'user-1', theme: 'dark', locale: 'en' };

function setup() {
  const userSettings = {
    get: vi.fn().mockResolvedValue(SAVED),
    update: vi.fn().mockResolvedValue(SAVED),
  };
  const app = { userSettings } as unknown as OppenheimerApp;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
    </QueryClientProvider>
  );
  return { wrapper, userSettings, queryClient };
}

describe('user settings', () => {
  it('reads the preferences through the kernel service', async () => {
    const { wrapper, userSettings } = setup();

    const { result } = renderHook(() => useUserSettings(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(userSettings.get).toHaveBeenCalled();
  });

  it('replaces them wholesale and shows the saved document', async () => {
    const { wrapper, userSettings, queryClient } = setup();
    const { result } = renderHook(() => useUpdateUserSettings(), { wrapper });

    const dto = {
      theme: 'dark',
      locale: 'en',
      density: 'compact',
      weeklyDigest: false,
      productUpdates: true,
    } as const;
    act(() => result.current.mutate(dto));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(userSettings.update).toHaveBeenCalledWith(dto);
    expect(queryClient.getQueryData(userSettingsKeys.me())).toBe(SAVED);
  });
});
