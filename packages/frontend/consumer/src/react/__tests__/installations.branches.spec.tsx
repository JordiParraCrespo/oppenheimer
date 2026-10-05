import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import { useRepositoryBranchesFor } from '../installations.queries';
import { fakeKernel } from './fake-kernel';

/**
 * Callers name the repositories in render, so every render hands this hook a
 * new array with the same contents. The `Map` it returns must hold while
 * nothing asked changes, or every picker row keyed on it re-renders with its
 * parent.
 */

function setup() {
  const service = {
    branches: vi.fn().mockResolvedValue([{ name: 'main', isDefault: true }]),
  };
  const app = fakeKernel({ [TOKENS.InstallationsRepository]: service });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
      </QueryClientProvider>
    );
  }
  return { wrapper };
}

describe('useRepositoryBranchesFor', () => {
  it('keeps the same map across renders that ask for the same repositories', async () => {
    const { wrapper } = setup();
    const { result, rerender } = renderHook(
      () => useRepositoryBranchesFor([{ installationId: 'i-1', githubRepoId: 42 }]),
      { wrapper },
    );

    await waitFor(() => expect(result.current.byRepository.get(42)).toHaveLength(1));
    const first = result.current.byRepository;
    rerender();
    expect(result.current.byRepository).toBe(first);
  });
});
