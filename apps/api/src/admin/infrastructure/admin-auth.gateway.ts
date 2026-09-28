import type { IncomingHttpHeaders } from 'node:http';
import { Inject, Injectable } from '@nestjs/common';
import type { AdminCreateUserDto, AdminUpdateUserDto, ListUsersQuery } from '@oppenheimer/shared';
import { DELEGATED_SESSION } from '../../auth/auth.di-tokens';
import { auth } from '../../auth/infrastructure/better-auth.config';
import { asRecord, betterAuthHeaders } from '../../auth/infrastructure/better-auth.util';
import type { DelegatedSessionPort } from '../../auth/infrastructure/delegated-session.port';
import { AdminUserMapper } from '../admin-user.mapper';
import type {
  AdminSessionResponseDto,
  AdminSuccessResponseDto,
  AdminUserListResponseDto,
  AdminUserResponseDto,
} from '../dtos/admin-user.response.dto';
import type { AdminAuthPort, BanInput, IssuedSession } from './admin-auth.port';
import { invokeAdminApi } from './admin-error.util';

/**
 * Better Auth infers the admin `role` type from the configured `adminRoles`.
 * The REST layer accepts free-form role strings, so we cast at the boundary.
 */
type AdminRole = 'user' | 'admin' | 'superadmin';
function asAdminRole(role: string | string[]): AdminRole | AdminRole[] {
  return role as AdminRole | AdminRole[];
}

/** The most session rows the admin list returns for one user. */
const MAX_LISTED_SESSIONS = 1_000;

/**
 * The admin port, over the Better Auth **admin** plugin (`auth.api.*`).
 *
 * Every call goes through `invokeAdminApi`, which folds Better Auth's errors
 * onto this module's catalog, and forwards the caller's headers so the plugin
 * can make its own permission check.
 */
@Injectable()
export class AdminAuthGateway implements AdminAuthPort {
  constructor(
    @Inject(DELEGATED_SESSION)
    private readonly delegatedSessions: DelegatedSessionPort,
  ) {}

  async listUsers(
    headers: IncomingHttpHeaders,
    query: Partial<ListUsersQuery>,
  ): Promise<AdminUserListResponseDto> {
    const result = await invokeAdminApi(() =>
      auth.api.listUsers({
        query: {
          searchValue: query.searchValue,
          searchField: query.searchField,
          limit: query.limit,
          offset: query.offset,
          sortBy: query.sortBy,
          sortDirection: query.sortDirection,
        },
        headers: betterAuthHeaders(headers),
      }),
    );
    return AdminUserMapper.toListResponse(result);
  }

  async getUser(headers: IncomingHttpHeaders, userId: string): Promise<AdminUserResponseDto> {
    const result = await invokeAdminApi(() =>
      auth.api.getUser({ query: { id: userId }, headers: betterAuthHeaders(headers) }),
    );
    return AdminUserMapper.fromEnvelope(result);
  }

  async createUser(
    headers: IncomingHttpHeaders,
    input: AdminCreateUserDto,
  ): Promise<AdminUserResponseDto> {
    const result = await invokeAdminApi(() =>
      auth.api.createUser({
        body: {
          email: input.email,
          name: input.name,
          password: input.password,
          role: input.role ? asAdminRole(input.role) : undefined,
        },
        headers: betterAuthHeaders(headers),
      }),
    );
    return AdminUserMapper.fromEnvelope(result);
  }

  async updateUser(
    headers: IncomingHttpHeaders,
    userId: string,
    data: AdminUpdateUserDto,
  ): Promise<AdminUserResponseDto> {
    const result = await invokeAdminApi(() =>
      auth.api.adminUpdateUser({
        body: { userId, data },
        headers: betterAuthHeaders(headers),
      }),
    );
    return AdminUserMapper.fromEnvelope(result);
  }

  async setRole(
    headers: IncomingHttpHeaders,
    userId: string,
    role: string | string[],
  ): Promise<AdminUserResponseDto> {
    const result = await invokeAdminApi(() =>
      auth.api.setRole({
        body: { userId, role: asAdminRole(role) },
        headers: betterAuthHeaders(headers),
      }),
    );
    return AdminUserMapper.fromEnvelope(result);
  }

  async ban(
    headers: IncomingHttpHeaders,
    userId: string,
    input: BanInput,
  ): Promise<AdminUserResponseDto> {
    const result = await invokeAdminApi(() =>
      auth.api.banUser({
        body: { userId, banReason: input.banReason, banExpiresIn: input.banExpiresIn },
        headers: betterAuthHeaders(headers),
      }),
    );
    // The ban deleted the user's session rows, delegated ones included, but
    // not the tokens cached for their credentials. Move them onto fresh keys.
    await this.delegatedSessions.invalidateForUser(userId);
    return AdminUserMapper.fromEnvelope(result);
  }

  async unban(headers: IncomingHttpHeaders, userId: string): Promise<AdminUserResponseDto> {
    const result = await invokeAdminApi(() =>
      auth.api.unbanUser({ body: { userId }, headers: betterAuthHeaders(headers) }),
    );
    // Anything cached since the ban points at a row the ban deleted; without
    // this, every façade call through the user's credentials would fail until
    // the entry expired.
    await this.delegatedSessions.invalidateForUser(userId);
    return AdminUserMapper.fromEnvelope(result);
  }

  async remove(headers: IncomingHttpHeaders, userId: string): Promise<AdminSuccessResponseDto> {
    const result = await invokeAdminApi(() =>
      auth.api.removeUser({ body: { userId }, headers: betterAuthHeaders(headers) }),
    );
    return AdminUserMapper.toSuccess(result);
  }

  async setPassword(
    headers: IncomingHttpHeaders,
    userId: string,
    newPassword: string,
  ): Promise<AdminSuccessResponseDto> {
    const result = await invokeAdminApi(() =>
      auth.api.setUserPassword({
        body: { userId, newPassword },
        headers: betterAuthHeaders(headers),
      }),
    );
    return AdminUserMapper.toSuccess(result);
  }

  /**
   * The user's live sessions, read from Postgres. Better Auth's
   * `listUserSessions` is still called, for the admin plugin's own permission
   * check, but its answer is not the list: with `secondaryStorage` it walks the
   * Redis index of cached sessions, which misses every session signed in
   * before the cache existed (they answer from Postgres until they expire) and
   * any whose index entry was lost. The table is the record.
   */
  async listSessions(
    headers: IncomingHttpHeaders,
    userId: string,
  ): Promise<AdminSessionResponseDto[]> {
    await this.assertMayListSessions(headers, userId);
    return AdminUserMapper.toSessionsResponse(await this.sessionRows(userId));
  }

  /**
   * The Better Auth admin API revokes by session token, and the token is a
   * live bearer credential, so it is never handed to the client (see
   * `AdminSessionResponseDto`). The id is resolved to its token here — after
   * the same permission check as the list, and from the same rows, so a
   * session the cache index never listed can be revoked too.
   */
  async sessionToken(
    headers: IncomingHttpHeaders,
    userId: string,
    sessionId: string,
  ): Promise<string | null> {
    await this.assertMayListSessions(headers, userId);
    const match = (await this.sessionRows(userId))
      .map(asRecord)
      .find((session) => String(session.id) === sessionId);
    return match ? String(match.token) : null;
  }

  async revokeSession(
    headers: IncomingHttpHeaders,
    token: string,
  ): Promise<AdminSuccessResponseDto> {
    const result = await invokeAdminApi(() =>
      auth.api.revokeUserSession({
        body: { sessionToken: token },
        headers: betterAuthHeaders(headers),
      }),
    );
    return AdminUserMapper.toSuccess(result);
  }

  async revokeAllSessions(
    headers: IncomingHttpHeaders,
    userId: string,
  ): Promise<AdminSuccessResponseDto> {
    const result = await invokeAdminApi(() =>
      auth.api.revokeUserSessions({ body: { userId }, headers: betterAuthHeaders(headers) }),
    );
    return AdminUserMapper.toSuccess(result);
  }

  async impersonate(headers: IncomingHttpHeaders, userId: string): Promise<IssuedSession> {
    const { response, headers: outHeaders } = await invokeAdminApi(() =>
      auth.api.impersonateUser({
        body: { userId },
        headers: betterAuthHeaders(headers),
        returnHeaders: true,
      }),
    );
    return { user: AdminUserMapper.fromEnvelope(response), cookies: outHeaders.getSetCookie() };
  }

  async stopImpersonating(headers: IncomingHttpHeaders): Promise<IssuedSession> {
    const { response, headers: outHeaders } = await invokeAdminApi(() =>
      auth.api.stopImpersonating({ headers: betterAuthHeaders(headers), returnHeaders: true }),
    );
    return { user: AdminUserMapper.fromEnvelope(response), cookies: outHeaders.getSetCookie() };
  }

  /** The admin plugin's own check that the caller may see `userId`'s sessions. */
  private async assertMayListSessions(headers: IncomingHttpHeaders, userId: string): Promise<void> {
    await invokeAdminApi(() =>
      auth.api.listUserSessions({ body: { userId }, headers: betterAuthHeaders(headers) }),
    );
  }

  /**
   * A user's unexpired session rows, newest first, straight from the table
   * (Better Auth's database adapter, which never reads the Redis copy).
   */
  private async sessionRows(userId: string): Promise<Record<string, unknown>[]> {
    const context = await auth.$context;
    return context.adapter.findMany<Record<string, unknown>>({
      model: 'session',
      where: [
        { field: 'userId', value: userId },
        { field: 'expiresAt', value: new Date(), operator: 'gt' },
      ],
      sortBy: { field: 'createdAt', direction: 'desc' },
      // Better Auth caps `findMany` at 100 unless told otherwise.
      limit: MAX_LISTED_SESSIONS,
    });
  }
}
