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
 * A user, and the `Set-Cookie` values that put the caller's browser on the
 * session the call just issued. Impersonating someone, and stopping, both
 * replace the session the request was made with; a client that never stores
 * the new cookie is still acting as whoever it was before.
 */
export interface IssuedSession {
  user: AdminUserResponseDto;
  cookies: string[];
}

/**
 * What the admin use cases need done to other people's accounts.
 *
 * The identity provider owns the `user` and `session` tables, the password
 * hashing, bans and impersonation, and checks the caller may administer
 * accounts at all; every method takes the incoming request's headers so it
 * can. That a ban also has to evict the cached delegated sessions of the
 * account, or that a session list is read from Postgres rather than the
 * provider's cache index, are facts about the adapter — a handler names
 * neither.
 */
export interface AdminAuthPort {
  listUsers(
    headers: IncomingHttpHeaders,
    query: Partial<ListUsersQuery>,
  ): Promise<AdminUserListResponseDto>;
  getUser(headers: IncomingHttpHeaders, userId: string): Promise<AdminUserResponseDto>;
  createUser(
    headers: IncomingHttpHeaders,
    input: AdminCreateUserDto,
  ): Promise<AdminUserResponseDto>;
  updateUser(
    headers: IncomingHttpHeaders,
    userId: string,
    data: AdminUpdateUserDto,
  ): Promise<AdminUserResponseDto>;
  setRole(
    headers: IncomingHttpHeaders,
    userId: string,
    role: string | string[],
  ): Promise<AdminUserResponseDto>;
  ban(headers: IncomingHttpHeaders, userId: string, input: BanInput): Promise<AdminUserResponseDto>;
  unban(headers: IncomingHttpHeaders, userId: string): Promise<AdminUserResponseDto>;
  remove(headers: IncomingHttpHeaders, userId: string): Promise<AdminSuccessResponseDto>;
  setPassword(
    headers: IncomingHttpHeaders,
    userId: string,
    newPassword: string,
  ): Promise<AdminSuccessResponseDto>;

  /** The account's live sessions. Never their tokens: those are credentials. */
  listSessions(headers: IncomingHttpHeaders, userId: string): Promise<AdminSessionResponseDto[]>;
  /**
   * The token of one of `userId`'s live sessions, named by id; `null` when
   * they hold no such session. It stays inside the API: the provider revokes
   * by token, and a client is only ever shown the id.
   */
  sessionToken(
    headers: IncomingHttpHeaders,
    userId: string,
    sessionId: string,
  ): Promise<string | null>;
  revokeSession(headers: IncomingHttpHeaders, token: string): Promise<AdminSuccessResponseDto>;
  revokeAllSessions(headers: IncomingHttpHeaders, userId: string): Promise<AdminSuccessResponseDto>;

  /** Start acting as `userId`, on a session the provider issues for it. */
  impersonate(headers: IncomingHttpHeaders, userId: string): Promise<IssuedSession>;
  /** End an impersonation and restore the administrator's own session. */
  stopImpersonating(headers: IncomingHttpHeaders): Promise<IssuedSession>;
}
