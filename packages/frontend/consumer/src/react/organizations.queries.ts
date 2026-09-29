'use client';

import {
  refetchEverythingForNewIdentity,
  useQuery,
  withCacheOnSuccess,
} from '@oppenheimer/frontend-core/react';
import {
  skipToken,
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { CONSUMER_CONFIG } from '../config';
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
  slugs: () => [...organizationsKeys.all, 'slug'] as const,
  slug: (slug: string | undefined) => [...organizationsKeys.slugs(), slug] as const,
};

/**
 * Whether a workspace address is free. The onboarding step asks this while the
 * reader types, so callers debounce the value they pass — this hook is a plain
 * query over whatever it is handed.
 *
 * `undefined` is "no question yet" — the caller passes it for an empty or
 * still-changing address, and the query does not fetch (`skipToken`). The step
 * shows its neutral hint for it rather than a verdict.
 *
 * Deliberately not cached for long. An address is free until somebody takes
 * it, and a stale `true` sends the reader into a create that then fails.
 */
export function useCheckSlug(
  slug: string | undefined,
  options?: Omit<UseQueryOptions<boolean, Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();

  return useQuery({
    queryKey: organizationsKeys.slug(slug),
    queryFn: slug ? () => app.organizations.checkSlug(slug) : skipToken,
    staleTime: 0,
    gcTime: CONSUMER_CONFIG.organizations.slugCheckGcMs,
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

/** What onboarding step 2 submits: the chosen name and address, over the row it read. */
export interface ClaimPersonalWorkspaceVariables {
  existing: OrganizationEntity | undefined;
  name: string;
  slug: string;
}

/**
 * Claim the personal workspace — name the row sign-up provisioned, or create
 * one for the account that has none.
 *
 * With no row to name, this creates the workspace, which changes where the
 * caller stands: the shell, the nav's permission set and every org-scoped list
 * were answers to "who are you and where", so every cached read is refetched —
 * a narrow invalidation would leave the app reading a cached "you belong
 * nowhere" and bounce the reader back to onboarding. The reply is seeded into
 * the list first, so even a failed refetch no longer says that. Naming an
 * existing row changes only that row, so it is patched into the list.
 */
export function useClaimPersonalWorkspace(
  options?: UseMutationOptions<OrganizationEntity, Error, ClaimPersonalWorkspaceVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: ClaimPersonalWorkspaceVariables) =>
      app.organizations.claimPersonalWorkspace(variables),
    ...withCacheOnSuccess(options, async (organization, { existing }) => {
      queryClient.setQueryData<OrganizationEntity[]>(organizationsKeys.list(), (current) =>
        current?.some((row) => row.id === organization.id)
          ? current.map((row) => (row.id === organization.id ? organization : row))
          : [...(current ?? []), organization],
      );
      if (!existing) await refetchEverythingForNewIdentity(queryClient);
    }),
  });
}
