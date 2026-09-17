import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import type { OrganizationEntity } from '../../modules/organizations';
import { organizationsKeys, useCreateOrganization } from '../organizations.queries';
import { fakeKernel } from './fake-kernel';

const CREATED = { id: 'org-1', name: 'Acme', slug: 'acme', logo: null } as OrganizationEntity;

function setup() {
  const organizations = { create: vi.fn().mockResolvedValue(CREATED) };
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

  return { wrapper, organizations, queryClient, invalidate };
}

describe('useCreateOrganization', () => {
  it('seeds the organizations list with the reply before refetching', async () => {
    // The shell redirects a settled empty list to onboarding. Seeding the list
    // means that even a failed refetch no longer says the caller belongs
    // nowhere.
    const { wrapper, queryClient } = setup();
    queryClient.setQueryData(organizationsKeys.list(), []);
    const { result } = renderHook(() => useCreateOrganization(), { wrapper });

    result.current.mutate({ name: 'Acme' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(organizationsKeys.list())).toEqual([CREATED]);
  });

  it('runs the caller-supplied onSuccess only once the refetch has settled', async () => {
    const { wrapper, invalidate } = setup();
    let released: () => void = () => {};
    invalidate.mockImplementation(() => new Promise<void>((resolve) => (released = resolve)));
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useCreateOrganization({ onSuccess }), { wrapper });

    result.current.mutate({ name: 'Acme' });

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith());
    expect(onSuccess).not.toHaveBeenCalled();

    released();
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});
