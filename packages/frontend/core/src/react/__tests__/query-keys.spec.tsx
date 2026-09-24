import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { OppenheimerApp } from '../../di/oppenheimer-app';
import { analyticsKeys } from '../analytics.queries';
import { authKeys, useLogout } from '../auth.queries';
import { capabilitiesKeys } from '../capabilities.queries';
import { OppenheimerProvider } from '../context';
import { userSettingsKeys } from '../user-settings.queries';
import { usersKeys, useUpdateUser } from '../users.queries';

/** Does `prefix` fuzzy-match `key`, the way `invalidateQueries` would? */
function covers(prefix: readonly unknown[], key: readonly unknown[]): boolean {
  return JSON.stringify(key.slice(0, prefix.length)) === JSON.stringify(prefix);
}

describe('kernel key factories', () => {
  it('root every key at its feature, which is what persistence filters on', () => {
    const cases: [readonly unknown[], (readonly unknown[])[]][] = [
      [authKeys.all, [authKeys.session()]],
      [analyticsKeys.all, [analyticsKeys.flags()]],
      [capabilitiesKeys.all, [capabilitiesKeys.deployment()]],
      [userSettingsKeys.all, [userSettingsKeys.me()]],
      [
        usersKeys.all,
        [usersKeys.list(), usersKeys.detail('42'), usersKeys.me(), usersKeys.permissions()],
      ],
    ];
    for (const [root, keys] of cases) {
      for (const key of keys) expect(covers(root, key)).toBe(true);
    }
  });

  it('never hands a root to a query, so the root keeps meaning "everything"', () => {
    expect(capabilitiesKeys.deployment()).not.toEqual(capabilitiesKeys.all);
  });

  it('scopes lists and details apart, so no id can land on a sibling key', () => {
    expect(usersKeys.detail('me')).not.toEqual(usersKeys.me());
    expect(covers(usersKeys.lists(), usersKeys.list({ search: 'jane' }))).toBe(true);
    expect(covers(usersKeys.lists(), usersKeys.detail('42'))).toBe(false);
    expect(covers(usersKeys.details(), usersKeys.detail('42'))).toBe(true);
  });
});

function setup() {
  const auth = { logout: vi.fn().mockResolvedValue(undefined) };
  const users = { update: vi.fn().mockResolvedValue({ id: 'user-1', firstName: 'Saved' }) };
  const app = { auth, users } as unknown as OppenheimerApp;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
    </QueryClientProvider>
  );
  return { wrapper, queryClient };
}

describe('a caller’s onSuccess runs alongside the cache update, never instead of it', () => {
  it('logout still clears the cache when the screen navigates on success', async () => {
    const { wrapper, queryClient } = setup();
    queryClient.setQueryData(usersKeys.me(), { id: 'user-1' });
    const navigate = vi.fn();

    const { result } = renderHook(() => useLogout({ onSuccess: navigate }), { wrapper });
    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(navigate).toHaveBeenCalled();
    expect(queryClient.getQueryData(usersKeys.me())).toBeUndefined();
  });

  it('an update still writes the saved user into its detail', async () => {
    const { wrapper, queryClient } = setup();
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useUpdateUser({ onSuccess }), { wrapper });
    act(() => result.current.mutate({ id: 'user-1', dto: { firstName: 'Saved' } }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(onSuccess).toHaveBeenCalled();
    expect(queryClient.getQueryData(usersKeys.detail('user-1'))).toEqual({
      id: 'user-1',
      firstName: 'Saved',
    });
  });
});
