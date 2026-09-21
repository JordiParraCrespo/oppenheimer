'use client';

import type { UpdateOrganizationRequest } from '@oppenheimer/api-client';
import type { CreateOrganizationDto } from '@oppenheimer/shared';
import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { OrganizationEntity } from '../modules/organizations/organization.entity';
import { useConsumerApp } from './context';

/**
 * The personal workspace's hooks: read it, rename it, and create one for an
 * account that ended up without. Members and invitations have no hook here on
 * purpose — the workspace is personal (`product/versions/mvp/08-auth.md`), and
 * a roster is the teams slice's to add, not something to wire from a hook that
 * happened to be sitting here.
 */
export const organizationsKeys = {
  all: ['organizations'] as const,
  lists: () => [...organizationsKeys.all, 'list'] as const,
  list: () => [...organizationsKeys.lists()] as const,
  slug: (slug: string) => [...organizationsKeys.all, 'slug', slug] as const,
};

/**
 * Whether a workspace address is free. The onboarding step asks this while the
 * reader types, so callers debounce the value they pass — this hook is a plain
 * query over whatever it is handed.
 *
 * `enabled` is the caller's: an empty address is not a question worth asking,
 * and the step shows its neutral hint for it rather than a verdict.
 *
 * Deliberately not cached for long. An address is free until somebody takes
 * it, and a stale `true` sends the reader into a create that then fails.
 */
export function useCheckSlug(
  slug: string,
  options?: Omit<UseQueryOptions<boolean, Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();

  return useQuery({
    queryKey: organizationsKeys.slug(slug),
    queryFn: () => app.organizations.checkSlug(slug),
    staleTime: 0,
    gcTime: 30_000,
    retry: false,
    ...options,
  });
}

/** The workspaces the signed-in user belongs to: their personal one, today. */
export function useOrganizations(
  options?: Omit<UseQueryOptions<OrganizationEntity[], Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();

  return useQuery({
    queryKey: organizationsKeys.list(),
    queryFn: () => app.organizations.findAll(),
    ...options,
  });
}

/**
 * Create the caller's workspace: the recovery path for an account that has
 * none.
 *
 * This drops the whole cache rather than one list: creating a workspace is
 * what puts the caller in one, and the shell, the nav's permission set and
 * every org-scoped list were all answers to "who are you and where" — a narrow
 * invalidation leaves the app reading a cached "you belong nowhere" and
 * bouncing them straight back to onboarding.
 *
 * The reply is the organization itself, so the list is seeded with it before
 * the refetch is awaited: even if that refetch fails, the cache no longer says
 * the caller belongs nowhere.
 */
export function useCreateOrganization(
  options?: UseMutationOptions<OrganizationEntity, Error, CreateOrganizationDto>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateOrganizationDto) => app.organizations.create(dto),
    ...options,
    onSuccess: async (...args) => {
      const [organization] = args;
      queryClient.setQueryData<OrganizationEntity[]>(organizationsKeys.list(), (current) => [
        ...(current ?? []),
        organization,
      ]);
      await queryClient.invalidateQueries();
      options?.onSuccess?.(...args);
    },
  });
}

export interface UpdateOrganizationVariables {
  id: string;
  changes: UpdateOrganizationRequest;
}

/**
 * Rename the workspace or change its mark.
 *
 * The reply is one organization while the cache holds the caller's whole list,
 * so the updated record is patched into that list rather than replacing it —
 * refetching would drop the other organizations for as long as the request
 * takes.
 */
export function useUpdateOrganization(
  options?: UseMutationOptions<OrganizationEntity, Error, UpdateOrganizationVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, changes }: UpdateOrganizationVariables) =>
      app.organizations.update(id, changes),
    ...options,
    onSuccess: (...args) => {
      const [organization] = args;
      queryClient.setQueryData<OrganizationEntity[]>(organizationsKeys.list(), (current) =>
        current?.map((entry) => (entry.id === organization.id ? organization : entry)),
      );
      options?.onSuccess?.(...args);
    },
  });
}
