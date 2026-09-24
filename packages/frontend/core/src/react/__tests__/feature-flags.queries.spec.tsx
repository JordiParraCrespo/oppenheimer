import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { OppenheimerApp } from '../../di/oppenheimer-app';
import { createAuthStore } from '../../modules/auth/auth.state';
import { OppenheimerProvider } from '../context';
import {
  featureFlagKeys,
  useFeatureFlag,
  useFeatureFlags,
  useFeatureFlagValue,
} from '../feature-flags.queries';

function setup(flags: Record<string, boolean | string> = {}) {
  const get = vi.fn().mockResolvedValue({ version: 'v1', flags });
  const recordExposure = vi.fn();
  const store = createAuthStore();

  const app = {
    featureFlags: { get, recordExposure },
    auth: { store },
  } as unknown as OppenheimerApp;

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
      </QueryClientProvider>
    );
  }

  return { wrapper, get, recordExposure, store, queryClient };
}

describe('useFeatureFlag', () => {
  it('reads the catalog default before the answer, then the answer', async () => {
    const { wrapper } = setup({ api_token_creation: false });
    const { result } = renderHook(() => useFeatureFlag('api_token_creation'), { wrapper });

    // `api_token_creation` is a kill switch: live until told otherwise.
    expect(result.current).toBe(true);
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('keeps the catalog default when the flags cannot be fetched', async () => {
    const { wrapper, get } = setup();
    get.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(
      () => ({ enabled: useFeatureFlag('api_token_creation'), query: useFeatureFlags() }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.query.isError).toBe(true));
    expect(result.current.enabled).toBe(true);
  });

  // Twenty flag reads on a screen must not become twenty requests.
  it('shares one fetch across every read', async () => {
    const { wrapper, get } = setup({ api_token_creation: true });
    const { result } = renderHook(
      () => ({
        a: useFeatureFlag('api_token_creation'),
        b: useFeatureFlagValue('api_token_creation'),
        all: useFeatureFlags(),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.all.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('reports the value it served for exposure, once the server has answered', async () => {
    const { wrapper, recordExposure } = setup({ api_token_creation: false });
    renderHook(() => useFeatureFlag('api_token_creation'), { wrapper });

    await waitFor(() => expect(recordExposure).toHaveBeenCalledWith('api_token_creation', false));
    expect(recordExposure).not.toHaveBeenCalledWith('api_token_creation', true);
  });
});

describe('sticky reads', () => {
  it('hold the first answer while a live read follows the refetch', async () => {
    const { wrapper, get, queryClient } = setup({ api_token_creation: true });
    const { result } = renderHook(
      () => ({
        sticky: useFeatureFlag('api_token_creation', { sticky: true }),
        live: useFeatureFlag('api_token_creation'),
        query: useFeatureFlags(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

    get.mockResolvedValue({ version: 'v2', flags: { api_token_creation: false } });
    await act(() => queryClient.invalidateQueries({ queryKey: featureFlagKeys.all }));

    await waitFor(() => expect(result.current.live).toBe(false));
    expect(result.current.sticky).toBe(true);
  });

  it('latch afresh when the caller signs in', async () => {
    const { wrapper, get, store } = setup({ api_token_creation: true });
    const { result } = renderHook(() => useFeatureFlag('api_token_creation', { sticky: true }), {
      wrapper,
    });
    await waitFor(() => expect(result.current).toBe(true));

    get.mockResolvedValue({ version: 'v2', flags: { api_token_creation: false } });
    act(() => store.setState({ isAuthenticated: true }));

    await waitFor(() => expect(result.current).toBe(false));
  });
});

describe('featureFlagKeys', () => {
  // The login page's anonymous flags must not be what the dashboard renders.
  it('separates a signed-in caller from an anonymous one', async () => {
    const { wrapper, get, store } = setup({ api_token_creation: true });
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    act(() => store.setState({ isAuthenticated: true }));

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });
});
