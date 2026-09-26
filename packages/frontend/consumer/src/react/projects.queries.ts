'use client';

import { withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { ProjectEntity, ProjectInput } from '../modules/projects/project.entity';
import { useConsumerApp } from './context';
import { sessionsKeys } from './sessions.queries';

/** Query key factory for the `projects` feature. */
export const projectsKeys = {
  all: ['projects'] as const,
  lists: () => [...projectsKeys.all, 'list'] as const,
  list: () => [...projectsKeys.lists()] as const,
};

/** The workspace's active projects, oldest first as the API lists them. */
export function useProjects(
  options?: Omit<UseQueryOptions<ProjectEntity[], Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();
  return useQuery({
    queryKey: projectsKeys.list(),
    queryFn: () => app.projects.findAll(),
    ...options,
  });
}

export function useCreateProject(options?: UseMutationOptions<ProjectEntity, Error, ProjectInput>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectInput) => app.projects.create(input),
    ...withCacheOnSuccess(options, () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.all });
    }),
  });
}

/** What saving a project posts: its id and the dialog's whole state. */
export interface UpdateProjectVariables {
  id: string;
  input: ProjectInput;
}

export function useUpdateProject(
  options?: UseMutationOptions<ProjectEntity, Error, UpdateProjectVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: UpdateProjectVariables) => app.projects.update(id, input),
    ...withCacheOnSuccess(options, () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.all });
    }),
  });
}

/**
 * Delete a project, which archives it. The API refuses while sessions nobody
 * has closed are listed in it; the sessions list is refreshed with the projects
 * so a group never outlives its project.
 */
export function useArchiveProject(options?: UseMutationOptions<void, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => app.projects.archive(id),
    ...withCacheOnSuccess(options, () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.all });
      queryClient.invalidateQueries({ queryKey: sessionsKeys.all });
    }),
  });
}
