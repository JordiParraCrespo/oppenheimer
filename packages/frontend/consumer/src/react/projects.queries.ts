'use client';

import { useQuery, useSuspenseQueries, useSuspenseQuery } from '@oppenheimer/frontend-core/react';
import { type UseQueryOptions, useQueryClient } from '@tanstack/react-query';
import type {
  CreateProjectInput,
  ProjectEntity,
  UpdateProjectInput,
} from '../modules/projects/project.entity';
import { useConsumerApp } from './context';
import { useHostListQuery } from './hosts.queries';
import { mutation } from './mutation';
import { projectsKeys } from './projects.keys';

/**
 * The projects of the caller's workspace, newest first: the project chip's
 * rows and the sidebar's groups. One read serves both, and it carries each
 * project's repositories and defaults, so picking one prefills the other
 * chips without a second request.
 *
 * Pass `select` to subscribe to less than the whole list; a component that
 * only needs it inside an event handler uses `useProjectsSnapshot` instead.
 */
export function useProjects<TData = ProjectEntity[]>(
  options?: Omit<UseQueryOptions<ProjectEntity[], Error, TData>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ProjectEntity[], Error, TData>({ ...useProjectListQuery(), ...options });
}

/**
 * {@link useProjects} under a Suspense `QueryState`; `select` reads less than
 * the whole list, as there.
 */
export function useSuspenseProjects<TData = ProjectEntity[]>(
  select?: (rows: ProjectEntity[]) => TData,
) {
  return useSuspenseQuery<ProjectEntity[], Error, TData>({
    ...useProjectListQuery(),
    ...(select ? { select } : {}),
  });
}

/**
 * The projects and the hosts under a Suspense `QueryState`, fetched side by
 * side: what New automation prefills its draft from. `error` is the first
 * refetch that failed over data already drawn.
 */
export function useSuspenseNewAutomation() {
  const [projects, hosts] = useSuspenseQueries({
    queries: [useProjectListQuery(), useHostListQuery()],
  });
  return { projects: projects.data, hosts: hosts.data, error: projects.error ?? hosts.error };
}

/**
 * The projects read, for every hook over it: the key and the fetch, once.
 * Not in the barrel; the sidebars' combined Suspense reads spread it.
 */
export function useProjectListQuery() {
  const app = useConsumerApp();
  return { queryKey: projectsKeys.list(), queryFn: () => app.projects.findAll() };
}

/**
 * The projects as the cache holds them right now, without subscribing to them.
 *
 * For a read that happens in an event handler — the send that checks the
 * picked project still exists — where `useProjects` would re-render the
 * component on every refetch for a list it never draws. `undefined` until
 * something on screen has read the list.
 */
export function useProjectsSnapshot(): () => ProjectEntity[] | undefined {
  const queryClient = useQueryClient();
  return () => queryClient.getQueryData<ProjectEntity[]>(projectsKeys.list());
}

export const useCreateProject = mutation<ProjectEntity, CreateProjectInput>({
  run: (app, input) => app.projects.create(input),
  invalidates: () => [projectsKeys.lists()],
});

export interface UpdateProjectVariables {
  id: string;
  input: UpdateProjectInput;
}

export const useUpdateProject = mutation<ProjectEntity, UpdateProjectVariables>({
  run: (app, { id, input }) => app.projects.update(id, input),
  invalidates: () => [projectsKeys.lists()],
});

/** Archive: the row stays so its slug is never reissued, and the listing leaves it out. */
export const useArchiveProject = mutation<ProjectEntity, string>({
  run: (app, id) => app.projects.archive(id),
  invalidates: () => [projectsKeys.lists()],
});
