import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import { useAcceptInvitation, useMyInvitations } from '../organizations.queries';
import { fakeKernel } from './fake-kernel';

/**
 * Membership of this product comes from an invitation, so these two are the
 * whole of what an account with no workspace can do.
 *
 * Accepting is the one mutation that changes *where the caller is*, not just
 * what a list holds: the server puts them in the organization and grants the
 * org-scoped role that opens it. Their permissions, the nav those permissions
 * gate, and every org-scoped read were all answers to a question that now has
 * a different answer — and the app's shell decides where to send them by a
 * cached organization list, so a narrow invalidation bounces someone who just
 * joined a workspace straight back to the screen saying they have none.
 */
function setup() {
  const organizations = {
    findMyInvitations: vi.fn().mockResolvedValue([]),
    acceptInvitation: vi.fn().mockResolvedValue({ id: 'invitation-1' }),
  };
  const app = fakeKernel({ [TOKENS.OrganizationsService]: organizations });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
      </QueryClientProvider>
    );
  }

  return { wrapper, organizations, invalidate };
}

describe('useMyInvitations', () => {
  it('asks for the invitations addressed to the caller, with no organization', async () => {
    const { wrapper, organizations } = setup();
    organizations.findMyInvitations.mockResolvedValue([{ id: 'invitation-1' }]);

    const { result } = renderHook(() => useMyInvitations(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(organizations.findMyInvitations).toHaveBeenCalledWith();
    expect(result.current.data).toEqual([{ id: 'invitation-1' }]);
  });
});

describe('useAcceptInvitation', () => {
  it('accepts the invitation it is given', async () => {
    const { wrapper, organizations } = setup();
    const { result } = renderHook(() => useAcceptInvitation(), { wrapper });

    result.current.mutate('invitation-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(organizations.acceptInvitation).toHaveBeenCalledWith('invitation-1');
  });

  it('drops the whole cache, not just the invitation list', async () => {
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useAcceptInvitation(), { wrapper });

    result.current.mutate('invitation-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // No key: everything the previous scope answered is now stale.
    expect(invalidate).toHaveBeenCalledWith();
  });

  it('runs the caller-supplied onSuccess only once the refetch has settled', async () => {
    // The caller navigates into the shell, which redirects a settled empty
    // organizations list to onboarding. If the navigation ran while the
    // cached `[]` was still being refetched, the reader was bounced back to
    // the screen they had just left.
    const { wrapper, invalidate } = setup();
    let released: () => void = () => {};
    invalidate.mockImplementation(() => new Promise<void>((resolve) => (released = resolve)));
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useAcceptInvitation({ onSuccess }), { wrapper });

    result.current.mutate('invitation-1');

    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    expect(onSuccess).not.toHaveBeenCalled();

    released();
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it('still runs a caller-supplied onSuccess', async () => {
    const { wrapper } = setup();
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useAcceptInvitation({ onSuccess }), { wrapper });

    result.current.mutate('invitation-1');

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});
