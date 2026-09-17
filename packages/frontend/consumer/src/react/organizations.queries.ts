'use client';

import type { UpdateOrganizationRequest } from '@oppenheimer/api-client';
import { MEMBER_LISTS_KEY } from '@oppenheimer/frontend-core/react';
import type { CreateOrganizationDto, InviteMemberDto, OrganizationRole } from '@oppenheimer/shared';
import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  OrganizationEntity,
  OrganizationInvitationEntity,
  OrganizationMemberEntity,
} from '../modules/organizations/organization.entity';
import type { MemberFilters } from '../modules/organizations/organizations.repository';
import { useConsumerApp } from './context';

export const organizationsKeys = {
  all: ['organizations'] as const,
  lists: () => [...organizationsKeys.all, 'list'] as const,
  list: () => [...organizationsKeys.lists()] as const,
  /**
   * Every member list there is, whatever organization and whatever filters.
   *
   * `'members'` sits *before* the organization id so this prefix exists at all.
   * It is what a mutation invalidates when it changes something a member list
   * is filtered by but does not know the organization of — assigning a user's
   * roles, which the role facet is now answered from.
   */
  membersAll: () => MEMBER_LISTS_KEY,
  /**
   * The filters are appended rather than always present, so the unfiltered key
   * stays a *prefix* of every narrowed one. The mutations below invalidate
   * `members(organizationId)`, and TanStack matches query keys by prefix — put
   * an `undefined` segment in the middle instead and that invalidation stops
   * reaching the narrowed lists, leaving a removed member on screen until the
   * reader clears the box.
   *
   * The role ids are sorted before they go in: picking `admin` then `user`
   * asks the same question as picking them the other way round, and an unsorted
   * key would fetch it twice and cache it under two entries.
   */
  members: (organizationId: string, filters?: MemberFilters) => {
    const roleIds = filters?.roleIds?.length ? [...filters.roleIds].sort() : [];
    return [
      ...organizationsKeys.membersAll(),
      organizationId,
      ...(filters?.search ? [filters.search] : []),
      ...(roleIds.length ? [roleIds] : []),
    ] as const;
  },
  invitations: (organizationId: string) =>
    [...organizationsKeys.all, organizationId, 'invitations'] as const,
  /** Invitations addressed to the caller, in no organization's scope. */
  myInvitations: () => [...organizationsKeys.all, 'invitations', 'mine'] as const,
};

/** The organizations the signed-in user belongs to. */
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
 * The organization's members, narrowed by the API rather than by the caller.
 *
 * `filters` is optional, and leaving it off is a real use: the team page keeps
 * one unnarrowed list to count the workspace and label its rows, alongside the
 * narrowed one the table renders.
 */
export function useOrganizationMembers(
  organizationId: string,
  filters?: MemberFilters,
  options?: Omit<UseQueryOptions<OrganizationMemberEntity[], Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();
  return useQuery({
    queryKey: organizationsKeys.members(organizationId, filters),
    queryFn: () => app.organizations.findMembers(organizationId, filters),
    enabled: Boolean(organizationId),
    ...options,
  });
}

export function useOrganizationInvitations(
  organizationId: string,
  options?: Omit<UseQueryOptions<OrganizationInvitationEntity[], Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();
  return useQuery({
    queryKey: organizationsKeys.invitations(organizationId),
    queryFn: () => app.organizations.findInvitations(organizationId),
    enabled: Boolean(organizationId),
    ...options,
  });
}

/**
 * Invitations addressed to the caller, whichever organization sent them.
 *
 * Unlike {@link useOrganizationInvitations} this needs no organization: it is
 * what an account that belongs to none can still ask, and the only thing it
 * can act on.
 */
export function useMyInvitations(
  options?: Omit<UseQueryOptions<OrganizationInvitationEntity[], Error>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();
  return useQuery({
    queryKey: organizationsKeys.myInvitations(),
    queryFn: () => app.organizations.findMyInvitations(),
    ...options,
  });
}

/**
 * Accept an invitation and land in the workspace it names.
 *
 * The whole cache is dropped rather than a list invalidated: accepting is what
 * puts the caller in a workspace, so their permissions, the nav those
 * permissions gate, and every org-scoped list were all answers to "who are you
 * and where" — and that question now has a different answer. A narrow
 * invalidation leaves the app's shell reading a cached "you belong nowhere"
 * and bouncing them back to the screen they just left.
 */
export function useAcceptInvitation(
  options?: UseMutationOptions<OrganizationInvitationEntity, Error, string>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => app.organizations.acceptInvitation(invitationId),
    ...options,
    onSuccess: async (...args) => {
      // Awaited, so the caller's `onSuccess` — which navigates into the shell —
      // runs only once the organizations list has been refetched. The shell
      // redirects a settled empty list to onboarding, and navigating while the
      // cached `[]` was still being refetched bounced the reader straight back.
      await queryClient.invalidateQueries();
      options?.onSuccess?.(...args);
    },
  });
}

/**
 * Create the caller's first (or next) organization.
 *
 * Like {@link useAcceptInvitation}, this drops the whole cache rather than one
 * list: creating a workspace is what puts the caller in one, and the shell,
 * the nav's permission set and every org-scoped list were all answers to "who
 * are you and where" — a narrow invalidation leaves the app reading a cached
 * "you belong nowhere" and bouncing them straight back to onboarding.
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

export interface InviteMembersVariables {
  organizationId: string;
  emails: string[];
  role: InviteMemberDto['role'];
}

export function useInviteMembers(
  options?: UseMutationOptions<OrganizationInvitationEntity[], Error, InviteMembersVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, emails, role }) =>
      Promise.all(emails.map((email) => app.organizations.invite(organizationId, { email, role }))),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        queryKey: organizationsKeys.invitations(args[1].organizationId),
      });
      options?.onSuccess?.(...args);
    },
  });
}

export function useUpdateOrganizationMemberRole(
  options?: UseMutationOptions<
    OrganizationMemberEntity,
    Error,
    { organizationId: string; memberId: string; role: OrganizationRole }
  >,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, memberId, role }) =>
      app.organizations.updateMemberRole(organizationId, memberId, role),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        queryKey: organizationsKeys.members(args[1].organizationId),
      });
      options?.onSuccess?.(...args);
    },
  });
}

export function useRemoveOrganizationMember(
  options?: UseMutationOptions<void, Error, { organizationId: string; memberId: string }>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, memberId }) =>
      app.organizations.removeMember(organizationId, memberId),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        queryKey: organizationsKeys.members(args[1].organizationId),
      });
      options?.onSuccess?.(...args);
    },
  });
}

export function useCancelOrganizationInvitation(
  options?: UseMutationOptions<void, Error, { organizationId: string; invitationId: string }>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invitationId }) => app.organizations.cancelInvitation(invitationId),
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        queryKey: organizationsKeys.invitations(args[1].organizationId),
      });
      options?.onSuccess?.(...args);
    },
  });
}

export interface UpdateOrganizationVariables {
  id: string;
  changes: UpdateOrganizationRequest;
}

/**
 * Rename an organization or change its mark.
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
