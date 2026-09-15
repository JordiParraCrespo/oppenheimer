import { asArray, asRecord } from '../auth/better-auth.util';
import type {
  FullOrganizationResponseDto,
  InvitationResponseDto,
  MemberResponseDto,
  MemberUserResponseDto,
  OrganizationResponseDto,
} from './dtos/organization.response.dto';
import type {
  WorkspaceMemberResponseDto,
  WorkspaceResponseDto,
} from './dtos/workspace.response.dto';

/**
 * Pure mappers from Better Auth organization-plugin API results to the module's
 * response DTOs. Kept framework-free so both the services and any tests can
 * reuse them. Every mapper accepts `unknown` and narrows once via `asRecord`,
 * so the services stay cast-free; this is where all response normalization
 * (coercion, envelope unwrapping, date parsing) lives.
 */

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(value as string);
}

function toDateOrNull(value: unknown): Date | null {
  return value == null ? null : toDate(value);
}

function parseMetadata(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return asRecord(value);
}

export function mapOrganization(input: unknown): OrganizationResponseDto {
  const o = asRecord(input);
  return {
    id: String(o.id),
    name: String(o.name),
    slug: String(o.slug),
    logo: (o.logo as string | null) ?? null,
    metadata: parseMetadata(o.metadata),
    createdAt: toDate(o.createdAt),
  };
}

export function mapMember(input: unknown): MemberResponseDto {
  const m = asRecord(input);
  return {
    id: String(m.id),
    organizationId: String(m.organizationId),
    userId: String(m.userId),
    role: String(m.role),
    createdAt: toDate(m.createdAt),
    user: m.user ? mapMemberUser(m.user) : null,
  };
}

export function mapMemberUser(input: unknown): MemberUserResponseDto {
  const user = asRecord(input);
  return {
    id: String(user.id),
    name: String(user.name ?? ''),
    email: String(user.email ?? ''),
    image: (user.image as string | null) ?? null,
    firstName: String(user.firstName ?? ''),
    lastName: String(user.lastName ?? ''),
    isActive: user.isActive !== false,
    emailVerified: user.emailVerified === true,
  };
}

export function mapInvitation(input: unknown): InvitationResponseDto {
  const i = asRecord(input);
  return {
    id: String(i.id),
    organizationId: String(i.organizationId),
    email: String(i.email),
    role: (i.role as string | null) ?? null,
    status: String(i.status),
    teamId: (i.teamId as string | null) ?? null,
    inviterId: String(i.inviterId),
    expiresAt: toDate(i.expiresAt),
    createdAt: toDate(i.createdAt),
  };
}

export function mapWorkspace(input: unknown): WorkspaceResponseDto {
  const t = asRecord(input);
  return {
    id: String(t.id),
    name: String(t.name),
    organizationId: String(t.organizationId),
    createdAt: toDate(t.createdAt),
    updatedAt: toDateOrNull(t.updatedAt),
  };
}

export function mapWorkspaceMember(input: unknown): WorkspaceMemberResponseDto {
  const tm = asRecord(input);
  return {
    id: String(tm.id),
    teamId: String(tm.teamId),
    userId: String(tm.userId),
    createdAt: toDate(tm.createdAt),
  };
}

export function mapFullOrganization(input: unknown): FullOrganizationResponseDto {
  const o = asRecord(input);
  return {
    ...mapOrganization(o),
    members: asArray(o.members).map(mapMember),
    invitations: asArray(o.invitations).map(mapInvitation),
    teams: asArray(o.teams).map(asRecord),
  };
}

/** One role a user holds: the name the search matches, the id the facet picks. */
export interface AssignedRole {
  id: string;
  name: string;
}

/**
 * The `user_role` join's raw rows, grouped by user.
 *
 * A row per assignment is what the query can return; a list per user is what
 * every caller wants, and building it is a shape transformation — so it lives
 * here with the rest of them rather than as a loop inside the service.
 */
export function mapAssignedRolesByUser(input: unknown): Map<string, AssignedRole[]> {
  const byUser = new Map<string, AssignedRole[]>();

  for (const row of asArray(input)) {
    const r = asRecord(row);
    const userId = String(r.userId);
    byUser.set(userId, [...(byUser.get(userId) ?? []), { id: String(r.id), name: String(r.name) }]);
  }

  return byUser;
}

export const mapOrganizations = (input: unknown): OrganizationResponseDto[] =>
  asArray(input).map(mapOrganization);
export const mapMembers = (input: unknown): MemberResponseDto[] => asArray(input).map(mapMember);
export const mapInvitations = (input: unknown): InvitationResponseDto[] =>
  asArray(input).map(mapInvitation);
/**
 * The pending subset of an invitation list. Better Auth cancels an invitation
 * by flipping its status to `canceled` rather than deleting it, and returns
 * every status from `listInvitations` — so the "pending invitations" endpoints
 * must drop anything already resolved, or a cancelled invite keeps coming back.
 */
export const mapPendingInvitations = (input: unknown): InvitationResponseDto[] =>
  mapInvitations(input).filter((invitation) => invitation.status === 'pending');
export const mapWorkspaces = (input: unknown): WorkspaceResponseDto[] =>
  asArray(input).map(mapWorkspace);
export const mapWorkspaceMembers = (input: unknown): WorkspaceMemberResponseDto[] =>
  asArray(input).map(mapWorkspaceMember);
