/**
 * Saving or forgetting a model provider's key re-reads both things a key
 * decides: the provider list, and whether the workspace can dictate. Without
 * the second, the mic on New session keeps the answer from before the change
 * for as long as the status stays fresh.
 */
import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import { botsKeys, usePutModelProviderKey, useRemoveModelProviderKey } from '../bots.queries';
import { voiceKeys } from '../voice.queries';
import { fakeKernel } from './fake-kernel';

function setup() {
  const repository = {
    putModelProviderKey: vi.fn(async () => undefined),
    removeModelProviderKey: vi.fn(async () => undefined),
  };
  const app = fakeKernel({ [TOKENS.BotsRepository]: repository });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
      </QueryClientProvider>
    );
  }
  return { wrapper, invalidate };
}

describe('model provider keys', () => {
  it('re-reads the providers and dictation when a key is saved', async () => {
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => usePutModelProviderKey(), { wrapper });

    await act(() => result.current.mutateAsync({ provider: 'openai', apiKey: 'sk-placeholder' }));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: botsKeys.providers() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: voiceKeys.all });
  });

  it('re-reads the providers and dictation when a key is forgotten', async () => {
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useRemoveModelProviderKey(), { wrapper });

    await act(() => result.current.mutateAsync('chatgpt'));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: botsKeys.providers() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: voiceKeys.all });
  });
});
