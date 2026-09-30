import type { IncomingHttpHeaders } from 'node:http';
import type { AdminCreateUserDto, AdminUpdateUserDto, ListUsersQuery } from '@oppenheimer/shared';
import type {
  AdminSessionResponseDto,
  AdminSuccessResponseDto,
  AdminUserListResponseDto,
  AdminUserResponseDto,
} from '../dtos/admin-user.response.dto';

/** How long a ban lasts and why, as the administrator gave it. */
export interface BanInput {
  banReason?: string;
  banExpiresIn?: number;
}

/**
 * The administrator an impersonation handed back, and the `Set-Cookie` values
 * that put the caller's browser on their restored session. A client that never
 * stores the new cookie is still acting as whoever it was impersonating.
 */
export interface IssuedSession {
  user: AdminUserResponseDto;
  cookies: string[];
}

/**
 * What the admin use cases need done to other people's accounts.
 *
 * The identity provider owns the `user` and `session` tables, password
 * hashing, bans and impersonation, and checks the caller may administer
 * accounts at all, so every method takes the incoming request's headers.
 * Evicting a banned account's delegated sessions, or reading sessions from
 * Postgres, is the adapter's business; a handler names neither.
 */
export interface AdminAuthPort {
  listUsers(
    headers: IncomingHttpHeaders,
    query: Partial<ListUsersQuery>,
  ): Promise<AdminUserListResponseDto>;
  getUser(headers: IncomingHttpHeaders, userId: string): Promise<AdminUserResponseDto>;
  /** Resolves to the new account's id. */
  createUser(headers: IncomingHttpHeaders, input: AdminCreateUserDto): Promise<string>;
  updateUser(headers: IncomingHttpHeaders, userId: string, data: AdminUpdateUserDto): Promise<void>;
  setRole(headers: IncomingHttpHeaders, userId: string, role: string | string[]): Promise<void>;
  ban(headers: IncomingHttpHeaders, userId: string, input: BanInput): Promise<void>;
  unban(headers: IncomingHttpHeaders, userId: string): Promise<void>;
  remove(headers: IncomingHttpHeaders, userId: string): Promise<AdminSuccessResponseDto>;
  setPassword(
    headers: IncomingHttpHeaders,
    userId: string,
    newPassword: string,
  ): Promise<AdminSuccessResponseDto>;

  /** The account's live sessions, newest first. Never their tokens: those are credentials. */
  listSessions(headers: IncomingHttpHeaders, userId: string): Promise<AdminSessionResponseDto[]>;
  /**
   * Sign out one of `userId`'s sessions, named by id; `ADMIN_009` when they
   * hold no such live session. The provider revokes by token, and the token
   * is a bearer credential, so resolving one is the adapter's business: no
   * token crosses this port.
   */
  revokeSessionById(
    headers: IncomingHttpHeaders,
    userId: string,
    sessionId: string,
  ): Promise<AdminSuccessResponseDto>;
  revokeAllSessions(headers: IncomingHttpHeaders, userId: string): Promise<AdminSuccessResponseDto>;

  /**
   * Start acting as `userId`, on a session the provider issues for it.
   * Resolves to the `Set-Cookie` values that move the caller's browser onto it.
   */
  impersonate(headers: IncomingHttpHeaders, userId: string): Promise<string[]>;
  /** End an impersonation and restore the administrator's own session. */
  stopImpersonating(headers: IncomingHttpHeaders): Promise<IssuedSession>;
}
