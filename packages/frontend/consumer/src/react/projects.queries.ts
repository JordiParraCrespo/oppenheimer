'use client';

import { withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  CreateProjectInput,
  ProjectEntity,
  UpdateProjectInput,
} from '../modules/projects/project.entity';
import { useConsumerApp } from './context';

export const projectsKeys = {
  all: ['projects'] as const,
  lists: () => [...projectsKeys.all, 'list'] as const,
  list: () => [...projectsKeys.lists()] as const,
};

/**
 * The projects of the caller's workspace, newest first: the project chip's
 * rows and the sidebar's groups. One read serves both, and it carries each
 * project's repositories and defaults, so picking one prefills the other
 * chips without a second request.
 */
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

export function useCreateProject(
  options?: UseMutationOptions<ProjectEntity, Error, CreateProjectInput>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectInput) => app.projects.create(input),
    ...withCacheOnSuccess(options, () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
    }),
  });
}

export interface UpdateProjectVariables {
  id: string;
  input: UpdateProjectInput;
}

export function useUpdateProject(
  options?: UseMutationOptions<ProjectEntity, Error, UpdateProjectVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: UpdateProjectVariables) => app.projects.update(id, input),
    ...withCacheOnSuccess(options, () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
    }),
  });
}

/** Archive: the row stays so its directory name is never reissued, and the listing leaves it out. */
export function useArchiveProject(options?: UseMutationOptions<ProjectEntity, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => app.projects.archive(id),
    ...withCacheOnSuccess(options, () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
    }),
  });
}
