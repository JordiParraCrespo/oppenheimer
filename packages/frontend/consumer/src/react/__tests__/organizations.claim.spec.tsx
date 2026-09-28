import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import type { OrganizationEntity } from '../../modules/organizations';
import { organizationsKeys, useClaimPersonalWorkspace } from '../organizations.queries';
import { fakeKernel } from './fake-kernel';

const CLAIMED = { id: 'org-1', name: 'Acme', slug: 'acme', logo: null } as OrganizationEntity;

function setup() {
  const organizations = { claimPersonalWorkspace: vi.fn().mockResolvedValue(CLAIMED) };
  const app = fakeKernel({ [TOKENS.OrganizationsService]: organizations });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
      </QueryClientProvider>
    );
  }

  return { wrapper, queryClient, invalidate };
}

describe('useClaimPersonalWorkspace', () => {
  it('seeds the list with a created workspace before refetching everything', async () => {
    // The shell redirects a settled empty list to onboarding. Seeding the list
    // means that even a failed refetch no longer says the caller belongs
    // nowhere.
    const { wrapper, queryClient, invalidate } = setup();
    queryClient.setQueryData(organizationsKeys.list(), []);
    const { result } = renderHook(() => useClaimPersonalWorkspace(), { wrapper });

    result.current.mutate({ existing: undefined, name: 'Acme', slug: 'acme' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(organizationsKeys.list())).toEqual([CLAIMED]);
    expect(invalidate).toHaveBeenCalledWith();
  });

  it('runs the caller-supplied onSuccess only once the refetch has settled', async () => {
    const { wrapper, invalidate } = setup();
    let released: () => void = () => {};
    invalidate.mockImplementation(() => new Promise<void>((resolve) => (released = resolve)));
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useClaimPersonalWorkspace({ onSuccess }), { wrapper });

    result.current.mutate({ existing: undefined, name: 'Acme', slug: 'acme' });

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith());
    expect(onSuccess).not.toHaveBeenCalled();

    released();
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it('patches a named workspace into the list without refetching everything', async () => {
    const { wrapper, queryClient, invalidate } = setup();
    const provisioned = { ...CLAIMED, name: 'jordi', slug: 'jordi-1a2b3c4d' } as OrganizationEntity;
    queryClient.setQueryData(organizationsKeys.list(), [provisioned]);
    const { result } = renderHook(() => useClaimPersonalWorkspace(), { wrapper });

    result.current.mutate({ existing: provisioned, name: 'Acme', slug: 'acme' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(organizationsKeys.list())).toEqual([CLAIMED]);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
