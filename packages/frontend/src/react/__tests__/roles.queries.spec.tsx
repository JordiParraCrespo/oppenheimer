import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { OppenheimerApp } from '../../di/oppenheimer-app';
import { OppenheimerProvider } from '../context';
import { organizationsKeys } from '../organizations.queries';
import {
  rolesKeys,
  useAssignUserRoles,
  useAuthorizationCatalog,
  useCreateRole,
  useDeleteRole,
  useRoles,
  useUpdateRole,
  useUserRoles,
} from '../roles.queries';
import { usersKeys } from '../users.queries';

/**
 * What a role mutation has to invalidate is not obvious from its name, and
 * getting it wrong is invisible: the write succeeds, the screen looks right,
 * and some *other* view stays stale until a refocus. Three cross-module
 * invalidations are asserted individually because each was added after being
 * missed —
 *
 *  - editing or deleting a role can change the caller's own ability, so the
 *    nav's permission set has to be refreshed rather than left until later;
 *  - reassigning a user's roles invalidates every organization's member list,
 *    because the team table's role facet is answered by that endpoint;
 *  - the catalog is cached for five minutes and is not part of `roles.all`
 *    invalidation by accident — it is nested under it on purpose.
 */

function setup() {
  const roles = {
    findAll: vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
    catalog: vi.fn().mockResolvedValue({ groups: [], grantable: [] }),
    findForUser: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 'role-1' }),
    update: vi.fn().mockResolvedValue({ id: 'role-1' }),
    remove: vi.fn().mockResolvedValue(undefined),
    assignToUser: vi.fn().mockResolvedValue([]),
  };

  const app = { roles } as unknown as OppenheimerApp;

  // Retries would turn a deliberate failure into a multi-second test.
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

  return { wrapper, roles, queryClient, invalidate };
}

/** The slice of a vitest spy this file reads — just the recorded arguments. */
interface CallRecorder {
  mock: { calls: unknown[][] };
}

/** Did anything invalidate exactly `key`? */
function invalidated(spy: CallRecorder, key: readonly unknown[]): boolean {
  return spy.mock.calls.some(([filters]) => {
    const queryKey = (filters as { queryKey?: readonly unknown[] })?.queryKey ?? [];
    return JSON.stringify(queryKey) === JSON.stringify(key);
  });
}

describe('rolesKeys', () => {
  it('nests every key under the module root', () => {
    for (const key of [
      rolesKeys.lists(),
      rolesKeys.list(),
      rolesKeys.catalog(),
      rolesKeys.user('user-1'),
    ]) {
      expect(key[0]).toBe('roles');
    }
  });

  it('keeps the params as the last segment so `lists()` stays a prefix', () => {
    // This is what lets one `invalidateQueries({ queryKey: lists() })` clear
    // every paged and searched variant at once.
    expect(rolesKeys.list({ page: 2 }).slice(0, 2)).toEqual(rolesKeys.lists());
  });

  it('treats no params and empty params as one cache entry', () => {
    expect(rolesKeys.list()).toEqual(rolesKeys.list({}));
  });

  it('gives two different searches different entries', () => {
    expect(rolesKeys.list({ search: 'a' })).not.toEqual(rolesKeys.list({ search: 'b' }));
  });

  it('keys a user’s roles per user', () => {
    expect(rolesKeys.user('user-1')).not.toEqual(rolesKeys.user('user-2'));
  });
});

describe('queries', () => {
  it('reads the role list through the service', async () => {
    const { wrapper, roles } = setup();

    const { result } = renderHook(() => useRoles({ page: 2 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(roles.findAll).toHaveBeenCalledWith({ page: 2 });
  });

  it('reads the catalog', async () => {
    const { wrapper, roles } = setup();

    const { result } = renderHook(() => useAuthorizationCatalog(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(roles.catalog).toHaveBeenCalled();
  });

  it('reads a user’s roles', async () => {
    const { wrapper, roles } = setup();

    const { result } = renderHook(() => useUserRoles('user-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(roles.findForUser).toHaveBeenCalledWith('user-1');
  });

  it('does not ask for the roles of an empty user id', async () => {
    // The id comes from a selected row, which is undefined before one is
    // picked. Asking anyway is a guaranteed 404 per render.
    const { wrapper, roles } = setup();

    renderHook(() => useUserRoles(''), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(roles.findForUser).not.toHaveBeenCalled();
  });
});

describe('mutations', () => {
  it('clears the whole roles tree after creating one', async () => {
    const { wrapper, roles, invalidate } = setup();

    const { result } = renderHook(() => useCreateRole(), { wrapper });
    result.current.mutate({ name: 'Editor', permissions: [] } as never);

    await waitFor(() => expect(roles.create).toHaveBeenCalled());
    await waitFor(() => expect(invalidated(invalidate, rolesKeys.all)).toBe(true));
  });

  describe('updating a role', () => {
    it('refreshes the caller’s own permission set', async () => {
      // Editing a role's permissions changes the ability of everyone holding
      // it, the caller included. Without this the nav keeps offering a route
      // they can no longer reach until something else refetches.
      const { wrapper, roles, invalidate } = setup();

      const { result } = renderHook(() => useUpdateRole(), { wrapper });
      result.current.mutate({ id: 'role-1', dto: { description: 'x' } });

      await waitFor(() =>
        expect(roles.update).toHaveBeenCalledWith('role-1', {
          description: 'x',
        }),
      );
      await waitFor(() => expect(invalidated(invalidate, usersKeys.permissions())).toBe(true));
    });

    it('still runs the caller’s own onSuccess', async () => {
      // The hook composes rather than replaces: a screen that closes its dialog
      // in `onSuccess` must not have that silently dropped.
      const { wrapper, invalidate } = setup();
      const onSuccess = vi.fn();

      const { result } = renderHook(() => useUpdateRole({ onSuccess }), {
        wrapper,
      });
      result.current.mutate({ id: 'role-1', dto: {} });

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
      expect(invalidated(invalidate, rolesKeys.all)).toBe(true);
    });
  });

  it('refreshes the permission set after deleting a role', async () => {
    // Deleting a role the caller held narrows their ability the same way.
    const { wrapper, roles, invalidate } = setup();

    const { result } = renderHook(() => useDeleteRole(), { wrapper });
    result.current.mutate('role-1');

    await waitFor(() => expect(roles.remove).toHaveBeenCalledWith('role-1'));
    await waitFor(() => expect(invalidated(invalidate, usersKeys.permissions())).toBe(true));
  });

  describe('assigning roles to a user', () => {
    it('invalidates that user’s roles, not every user’s', async () => {
      const { wrapper, roles, invalidate } = setup();

      const { result } = renderHook(() => useAssignUserRoles(), { wrapper });
      result.current.mutate({ userId: 'user-9', roleIds: ['role-1'] });

      await waitFor(() => expect(roles.assignToUser).toHaveBeenCalledWith('user-9', ['role-1']));
      await waitFor(() => expect(invalidated(invalidate, rolesKeys.user('user-9'))).toBe(true));
      expect(invalidated(invalidate, rolesKeys.user('user-1'))).toBe(false);
    });

    it('invalidates every organization’s member list', async () => {
      // The team table's role facet is answered by the members endpoint, so a
      // member list narrowed by a role is stale the moment that role moves.
      // Every organization's, because this mutation knows the user but not
      // which workspaces they are in.
      const { wrapper, invalidate } = setup();

      const { result } = renderHook(() => useAssignUserRoles(), { wrapper });
      result.current.mutate({ userId: 'user-9', roleIds: [] });

      await waitFor(() =>
        expect(invalidated(invalidate, organizationsKeys.membersAll())).toBe(true),
      );
    });

    it('refreshes the caller’s permission set too', async () => {
      const { wrapper, invalidate } = setup();

      const { result } = renderHook(() => useAssignUserRoles(), { wrapper });
      result.current.mutate({ userId: 'user-9', roleIds: [] });

      await waitFor(() => expect(invalidated(invalidate, usersKeys.permissions())).toBe(true));
    });
  });
});
