import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { OppenheimerApp } from '../../di/oppenheimer-app';
import { OppenheimerProvider } from '../context';
import { useUserSettings } from '../user-settings.queries';

const SAVED = { userId: 'user-1', theme: 'dark', locale: 'en' };

function setup() {
  const userSettings = {
    get: vi.fn().mockResolvedValue(SAVED),
  };
  const app = { userSettings } as unknown as OppenheimerApp;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
    </QueryClientProvider>
  );
  return { wrapper };
}

describe('user settings', () => {
  it('serves the preferences the kernel service read', async () => {
    const { wrapper } = setup();

    const { result } = renderHook(() => useUserSettings(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(SAVED));
  });
});
