import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import type { ProjectEntity } from '../../modules/projects/project.entity';
import {
  projectsKeys,
  useArchiveProject,
  useCreateProject,
  useProjects,
  useProjectsSnapshot,
  useUpdateProject,
} from '../projects.queries';
import { fakeKernel } from './fake-kernel';

/**
 * The projects list is read by the project chip and the sidebar's groups at
 * once, so what matters is that a refetch that changed nothing hands them the
 * same rows, that an event handler can read it without subscribing, and that
 * every write refreshes it before the caller's own `onSuccess` runs.
 */

class Project {
  constructor(
    public readonly id: string,
    public readonly name: string,
  ) {}
}
const project = (id: string, name = id) => new Project(id, name) as unknown as ProjectEntity;

function setup(service: Record<string, unknown>) {
  const app = fakeKernel({ [TOKENS.ProjectsRepository]: service });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
      </QueryClientProvider>
    );
  }
  return { wrapper, queryClient };
}

describe('projectsKeys', () => {
  it('keeps the list under the root', () => {
    expect(projectsKeys.list().slice(0, 1)).toEqual(projectsKeys.all);
    expect(projectsKeys.list()).toEqual(projectsKeys.lists());
  });
});

describe('useProjects', () => {
  it('keeps the rows of a refetch that changed nothing, and replaces only the one that did', async () => {
    const findAll = vi
      .fn()
      .mockResolvedValueOnce([project('p-1'), project('p-2')])
      .mockResolvedValue([project('p-1'), project('p-2', 'Renamed')]);
    const { wrapper, queryClient } = setup({ findAll });
    const { result } = renderHook(() => useProjects(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const first = result.current.data;

    await act(() => queryClient.refetchQueries({ queryKey: projectsKeys.list() }));

    await waitFor(() => expect(result.current.data?.[1]?.name).toBe('Renamed'));
    expect(result.current.data?.[0]).toBe(first?.[0]);
  });

  it('hands a narrowing select only what it picked', async () => {
    const { wrapper } = setup({ findAll: vi.fn().mockResolvedValue([project('p-1')]) });
    const { result } = renderHook(
      () => useProjects({ select: (rows) => rows.map((row) => row.id) }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data).toEqual(['p-1']));
  });
});

describe('useProjectsSnapshot', () => {
  it('reads the cached list at call time, without fetching it', async () => {
    const findAll = vi.fn();
    const { wrapper, queryClient } = setup({ findAll });
    const { result } = renderHook(() => useProjectsSnapshot(), { wrapper });

    expect(result.current()).toBeUndefined();

    const rows = [project('p-1')];
    queryClient.setQueryData(projectsKeys.list(), rows);
    expect(result.current()).toBe(rows);
    expect(findAll).not.toHaveBeenCalled();
  });
});

describe('project writes', () => {
  const cases = [
    {
      name: 'create',
      method: 'create',
      hook: useCreateProject,
      variables: { name: 'Web' },
      called: [{ name: 'Web' }],
    },
    {
      name: 'update',
      method: 'update',
      hook: useUpdateProject,
      variables: { id: 'p-1', input: { name: 'Renamed' } },
      called: ['p-1', { name: 'Renamed' }],
    },
    {
      name: 'archive',
      method: 'archive',
      hook: useArchiveProject,
      variables: 'p-1',
      called: ['p-1'],
    },
  ] as const;

  for (const { name, method, hook, variables, called } of cases) {
    it(`${name} calls the repository, leaves the list stale, then runs the caller's onSuccess`, async () => {
      const service = { [method]: vi.fn().mockResolvedValue(project('p-1')) };
      const { wrapper, queryClient } = setup(service);
      queryClient.setQueryData(projectsKeys.list(), [project('p-1')]);
      let staleWhenCalled: boolean | undefined;
      const onSuccess = vi.fn(() => {
        staleWhenCalled = queryClient.getQueryState(projectsKeys.list())?.isInvalidated;
      });
      const useHook = hook as unknown as (options: { onSuccess: typeof onSuccess }) => {
        mutateAsync: (variables: unknown) => Promise<unknown>;
      };
      const { result } = renderHook(() => useHook({ onSuccess }), { wrapper });

      await act(() => result.current.mutateAsync(variables));

      expect(service[method]).toHaveBeenCalledWith(...called);
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(staleWhenCalled).toBe(true);
    });
  }

  it('leaves the list alone when the write fails', async () => {
    const { wrapper, queryClient } = setup({ archive: vi.fn().mockRejectedValue(new Error('no')) });
    queryClient.setQueryData(projectsKeys.list(), [project('p-1')]);
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useArchiveProject({ onSuccess }), { wrapper });

    await act(() => result.current.mutateAsync('p-1').catch(() => undefined));

    expect(onSuccess).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(projectsKeys.list())?.isInvalidated).toBe(false);
  });
});
