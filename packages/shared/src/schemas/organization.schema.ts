import { z } from 'zod';
import { ORGANIZATION_ROLES } from '../constants';

/**
 * Request contracts for the organization / members / invitations / workspaces
 * REST modules (`apps/api/src/organizations`), which delegate to the Better Auth
 * organization plugin. Also usable for client-side form validation. Path
 * parameters (org id, member id, invitation id, team id) are validated as UUIDs
 * by the controllers, so only request bodies are modelled here.
 */

const organizationRole = z.enum([
  ORGANIZATION_ROLES.OWNER,
  ORGANIZATION_ROLES.ADMIN,
  ORGANIZATION_ROLES.MEMBER,
]);

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers and hyphens')
    .optional(),
  logo: z.string().url().optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  /**
   * `null` clears the mark. Without it there is no way back from a logo that
   * was set once — omitting the key means "leave it alone", which is a
   * different intent and cannot express removal.
   */
  logo: z.string().url().nullable().optional(),
});

export const checkSlugSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9-]+$/),
});

/**
 * How the team table narrows the member list, answered by the server.
 *
 * Both facets are here rather than in the browser because the endpoint is the
 * only place that can see the whole list: the table pages what it is given, so
 * a filter applied after the response narrows one page and leaves the rest of
 * the matches on the pages nobody looked at.
 */
export const listMembersSchema = z.object({
  /** Case-insensitive match on name, email, organization role or assigned role name. */
  search: z.string().max(200).optional(),
  /**
   * Role facet. A member matches when they hold *any* of these roles, which is
   * the union `user_role` documents as their effective set.
   *
   * Accepts a repeated query parameter (`?roleIds=a&roleIds=b`) or a single
   * value, which is what `URLSearchParams` produces for one selected option.
   */
  roleIds: z
    .union([z.string().uuid(), z.array(z.string().uuid())])
    .optional()
    .transform((value) => (value === undefined ? undefined : [value].flat())),
});

/** Invite a member to an organization (optionally scoped to a team/workspace). */
export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: organizationRole.default(ORGANIZATION_ROLES.MEMBER),
  teamId: z.string().uuid().optional(),
});

export const inviteMembersFormSchema = z.object({
  emails: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(/[\n,]+/)
        .map((email) => email.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().email()).min(1).max(25)),
  role: organizationRole,
});

/** Directly add an existing user as a member (server-side add, no invitation). */
export const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: organizationRole.default(ORGANIZATION_ROLES.MEMBER),
  teamId: z.string().uuid().optional(),
});

/** Change a member's organization role (member id is a path parameter). */
export const updateMemberRoleSchema = z.object({
  role: organizationRole,
});

/** Create a workspace (Better Auth team) inside an organization. */
export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  organizationId: z.string().uuid().optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
});

/** Add a user to a workspace (user id in the body, team id in the path). */
export const addWorkspaceMemberSchema = z.object({
  userId: z.string().uuid(),
});

export type CreateOrganizationDto = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationDto = z.infer<typeof updateOrganizationSchema>;
export type CheckSlugDto = z.infer<typeof checkSlugSchema>;
export type ListMembersDto = z.output<typeof listMembersSchema>;
export type InviteMemberDto = z.infer<typeof inviteMemberSchema>;
export type InviteMembersFormInput = z.input<typeof inviteMembersFormSchema>;
export type InviteMembersFormDto = z.output<typeof inviteMembersFormSchema>;
export type AddMemberDto = z.infer<typeof addMemberSchema>;
export type UpdateMemberRoleDto = z.infer<typeof updateMemberRoleSchema>;
export type CreateWorkspaceDto = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceDto = z.infer<typeof updateWorkspaceSchema>;
export type AddWorkspaceMemberDto = z.infer<typeof addWorkspaceMemberSchema>;
export type OrganizationRole = z.infer<typeof organizationRole>;
