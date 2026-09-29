import { asArray, asRecord } from '../auth/infrastructure/better-auth.util';
import type { Membership, MembershipUser } from './domain/membership.types';
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

/** One row of the member ⋈ user read, as `MemberRepository` aliases it. */
export interface MembershipRow {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  createdAt: Date;
  userName: string;
  userEmail: string;
  userImage: string | null;
  userFirstName: string;
  userLastName: string;
  userIsActive: boolean;
  userEmailVerified: boolean;
}

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

/**
 * Maps what the Better Auth organization plugin returns — and the rows of the
 * tables it owns, read straight from Postgres — onto this module's read models
 * and response DTOs: organizations, their members and invitations, and
 * workspaces (Better Auth teams).
 *
 * Better Auth owns and writes these tables, so there is no aggregate to map to
 * and from — the personal workspace, the one rule the app owns here, has its
 * own mapper. Every method accepts `unknown` and narrows once via `asRecord`,
 * so the gateways stay cast-free; this is where all response normalization
 * (coercion, envelope unwrapping, date parsing) lives.
 */
export class OrganizationMapper {
  static toOrganization(input: unknown): OrganizationResponseDto {
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

  static toOrganizations(input: unknown): OrganizationResponseDto[] {
    return asArray(input).map(OrganizationMapper.toOrganization);
  }

  static toFullOrganization(input: unknown): FullOrganizationResponseDto {
    const o = asRecord(input);
    return {
      ...OrganizationMapper.toOrganization(o),
      members: asArray(o.members).map(OrganizationMapper.toMember),
      invitations: asArray(o.invitations).map(OrganizationMapper.toInvitation),
      teams: asArray(o.teams).map(asRecord),
    };
  }

  static toMember(input: unknown): MemberResponseDto {
    const m = asRecord(input);
    return {
      id: String(m.id),
      organizationId: String(m.organizationId),
      userId: String(m.userId),
      role: String(m.role),
      createdAt: toDate(m.createdAt),
      user: m.user ? OrganizationMapper.toMemberUser(m.user) : null,
    };
  }

  static toMembers(input: unknown): MemberResponseDto[] {
    return asArray(input).map(OrganizationMapper.toMember);
  }

  static toMemberUser(input: unknown): MemberUserResponseDto {
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

  static toMembership(row: MembershipRow): Membership {
    return {
      id: row.id,
      organizationId: row.organizationId,
      userId: row.userId,
      role: row.role,
      createdAt: toDate(row.createdAt),
      user: {
        id: row.userId,
        name: row.userName,
        email: row.userEmail,
        image: row.userImage,
        firstName: row.userFirstName,
        lastName: row.userLastName,
        isActive: row.userIsActive,
        emailVerified: row.userEmailVerified,
      },
    };
  }

  static toMembershipUser(user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    firstName: string;
    lastName: string;
    isActive: boolean;
    emailVerified: boolean;
  }): MembershipUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
    };
  }

  /**
   * Put the account behind each membership on it. Better Auth's member rows
   * carry a thin `user`, when they carry one at all; the members list shows
   * the account as the users table has it.
   */
  static withAccounts(
    members: MemberResponseDto[],
    accounts: MembershipUser[],
  ): MemberResponseDto[] {
    const byId = new Map(accounts.map((account) => [account.id, account]));
    return members.map((member) => ({ ...member, user: byId.get(member.userId) ?? member.user }));
  }

  static toInvitation(input: unknown): InvitationResponseDto {
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

  static toInvitations(input: unknown): InvitationResponseDto[] {
    return asArray(input).map(OrganizationMapper.toInvitation);
  }

  /**
   * The pending subset of an invitation list. Better Auth cancels an invitation
   * by flipping its status to `canceled` rather than deleting it, and returns
   * every status from `listInvitations` — so the "pending invitations" endpoints
   * must drop anything already resolved, or a cancelled invite keeps coming back.
   */
  static toPendingInvitations(input: unknown): InvitationResponseDto[] {
    return OrganizationMapper.toInvitations(input).filter(
      (invitation) => invitation.status === 'pending',
    );
  }

  static toWorkspace(input: unknown): WorkspaceResponseDto {
    const t = asRecord(input);
    return {
      id: String(t.id),
      name: String(t.name),
      organizationId: String(t.organizationId),
      createdAt: toDate(t.createdAt),
      updatedAt: toDateOrNull(t.updatedAt),
    };
  }

  static toWorkspaces(input: unknown): WorkspaceResponseDto[] {
    return asArray(input).map(OrganizationMapper.toWorkspace);
  }

  static toWorkspaceMember(input: unknown): WorkspaceMemberResponseDto {
    const tm = asRecord(input);
    return {
      id: String(tm.id),
      teamId: String(tm.teamId),
      userId: String(tm.userId),
      createdAt: toDate(tm.createdAt),
    };
  }

  static toWorkspaceMembers(input: unknown): WorkspaceMemberResponseDto[] {
    return asArray(input).map(OrganizationMapper.toWorkspaceMember);
  }
}
