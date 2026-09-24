import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import * as entry from '../index';
import {
  cachedKeys,
  exported,
  factoryFor,
  invalidated,
  same,
  setup,
  startsWith,
} from './_eval-harness';

type Keys = Record<string, unknown> & {
  all: readonly unknown[];
  lists: () => readonly unknown[];
  list: (filters?: unknown) => readonly unknown[];
  details: () => readonly unknown[];
  detail: (id: string | undefined) => readonly unknown[];
};
type Mutation<V> = (options?: {
  onSuccess?: (...args: unknown[]) => unknown;
}) => UseMutationResult<unknown, Error, V>;

const project = (name: string) => ({
  id: 'project-1',
  name,
  slug: 'oppenheimer',
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

function arrange() {
  const service = {
    findAll: vi.fn(async () => [project('Oppenheimer')]),
    findById: vi.fn(async () => project('Oppenheimer')),
    rename: vi.fn(async (_id: string, name: string) => project(name)),
    // Archiving retires the row rather than deleting it: the API answers with it.
    archive: vi.fn(async () => ({ ...project('Oppenheimer'), archivedAt: new Date(1) })),
  };
  const keys = exported<Keys>(entry, 'projectsKeys');
  return { service, keys, ...setup({ [TOKENS.ProjectsService]: service }) };
}

describe('projects-module', () => {
  it('exports projectsKeys and the four hooks from the react entry', () => {
    for (const name of [
      'projectsKeys',
      'useProjects',
      'useProject',
      'useRenameProject',
      'useArchiveProject',
    ]) {
      expect(typeof exported(entry, name)).not.toBe('undefined');
    }
  });

  it('builds the key ladder: all → lists → list(filters), details → detail(id)', () => {
    const keys = exported<Keys>(entry, 'projectsKeys');
    expect(Array.isArray(keys.all)).toBe(true);
    for (const level of ['lists', 'list', 'details', 'detail']) {
      expect(typeof keys[level]).toBe('function');
    }
    expect(startsWith(keys.lists(), keys.all)).toBe(true);
    expect(startsWith(keys.list({ includeArchived: true }), keys.lists())).toBe(true);
    expect(startsWith(keys.details(), keys.all)).toBe(true);
    expect(startsWith(keys.detail('project-1'), keys.details())).toBe(true);
    expect(startsWith(keys.detail('project-1'), keys.lists())).toBe(false);
  });

  it('keys each filter combination separately, both under lists()', async () => {
    const { keys, wrapper, queryClient } = arrange();
    const useProjects = exported<(filters?: unknown) => UseQueryResult<unknown>>(
      entry,
      'useProjects',
    );
    const all = renderHook(() => useProjects({ includeArchived: true }), { wrapper });
    const current = renderHook(() => useProjects({}), { wrapper });
    await waitFor(() => expect(all.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(current.result.current.isSuccess).toBe(true));
    const cached = cachedKeys(queryClient);
    expect(cached).toHaveLength(2);
    for (const key of cached) expect(startsWith(key, keys.lists())).toBe(true);
    expect(factoryFor(keys, cached[0] ?? [], [{ includeArchived: true }])).toBeDefined();
  });

  it('holds a project read off while its id is unknown, and keys it by detail(id)', async () => {
    const { keys, wrapper, queryClient, service } = arrange();
    const useProject = exported<(id: string | undefined) => UseQueryResult<unknown>>(
      entry,
      'useProject',
    );
    renderHook(() => useProject(undefined), { wrapper });
    expect(service.findById).not.toHaveBeenCalled();
    const known = renderHook(() => useProject('project-1'), { wrapper });
    await waitFor(() => expect(known.result.current.isSuccess).toBe(true));
    expect(cachedKeys(queryClient).some((key) => same(key, keys.detail('project-1')))).toBe(true);
    expect(JSON.stringify(cachedKeys(queryClient))).not.toContain('""');
  });

  it('rename writes the saved row, refreshes the lists, and still runs the caller onSuccess', async () => {
    const { keys, wrapper, queryClient } = arrange();
    queryClient.setQueryData(keys.detail('project-1'), project('Oppenheimer'));
    queryClient.setQueryData(keys.list({}), [project('Oppenheimer')]);
    const onSuccess = vi.fn();
    const useRenameProject = exported<Mutation<{ id: string; name: string }>>(
      entry,
      'useRenameProject',
    );
    const { result } = renderHook(() => useRenameProject({ onSuccess }), { wrapper });
    act(() => result.current.mutate({ id: 'project-1', name: 'Renamed' }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(onSuccess).toHaveBeenCalled();
    const detail = queryClient.getQueryData<{ name: string }>(keys.detail('project-1'));
    expect(detail?.name).toBe('Renamed');
    expect(invalidated(queryClient, keys.detail('project-1'))).toBe(false);
    const list = queryClient.getQueryData<{ name: string }[]>(keys.list({}));
    const listFresh = list?.some((row) => row.name === 'Renamed') ?? false;
    expect(listFresh || invalidated(queryClient, keys.list({}))).toBe(true);
  });

  it('archive writes or drops the detail, refreshes the lists, and still runs the caller onSuccess', async () => {
    const { keys, wrapper, queryClient } = arrange();
    queryClient.setQueryData(keys.detail('project-1'), project('Oppenheimer'));
    queryClient.setQueryData(keys.list({}), [project('Oppenheimer')]);
    queryClient.setQueryData(['sessions', 'list'], []);
    const onSuccess = vi.fn();
    const useArchiveProject = exported<Mutation<string>>(entry, 'useArchiveProject');
    const { result } = renderHook(() => useArchiveProject({ onSuccess }), { wrapper });
    act(() => result.current.mutate('project-1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(onSuccess).toHaveBeenCalled();
    // Dropped, marked stale, or replaced by the archived row the API answered
    // with: anything but the pre-archive row still cached as fresh.
    const detail = queryClient.getQueryData<{ archivedAt?: Date }>(keys.detail('project-1'));
    const detailHandled =
      detail === undefined ||
      detail.archivedAt !== undefined ||
      invalidated(queryClient, keys.detail('project-1'));
    expect(detailHandled).toBe(true);
    const list = queryClient.getQueryData<unknown[]>(keys.list({}));
    expect(invalidated(queryClient, keys.list({})) || list?.length === 0).toBe(true);
    expect(invalidated(queryClient, ['sessions', 'list'])).toBe(false);
  });
});
