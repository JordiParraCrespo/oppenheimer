import type { IncomingHttpHeaders } from 'node:http';
import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import type { AdminCreateUserDto, AdminUpdateUserDto, ListUsersQuery } from '@oppenheimer/shared';
import { DELEGATED_SESSION } from '../auth/auth.di-tokens';
import { auth } from '../auth/infrastructure/better-auth.config';
import { asRecord, betterAuthHeaders } from '../auth/infrastructure/better-auth.util';
import type { DelegatedSessionPort } from '../auth/infrastructure/delegated-session.port';
import { mapSessionsFromResult, mapSuccess, mapUserFromResult, mapUserList } from './admin.mappers';
import { invokeAdminApi } from './admin-error.mapper';
import { AdminErrors } from './domain/admin.errors';
import type {
  AdminSessionResponseDto,
  AdminUserListResponseDto,
  AdminUserResponseDto,
} from './dtos/admin-user.response.dto';

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
 * Delegating façade over the Better Auth **admin** plugin (`auth.api.*`).
 * Provides super-admin user management. Response normalization lives in
 * `admin.mappers.ts`; impersonation issues a session cookie, so those calls
 * return Better Auth's response headers for the controller to forward.
 */
@Injectable()
export class AdminService {
  constructor(
    @Inject(DELEGATED_SESSION)
    private readonly delegatedSessions: DelegatedSessionPort,
  ) {}

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

  private headers(headers: IncomingHttpHeaders): Headers {
    return betterAuthHeaders(headers);
  }

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
        headers: this.headers(headers),
      }),
    );
    return mapUserList(result);
  }

  async getUser(headers: IncomingHttpHeaders, id: string): Promise<AdminUserResponseDto> {
    const result = await invokeAdminApi(() =>
      auth.api.getUser({ query: { id }, headers: this.headers(headers) }),
    );
    return mapUserFromResult(result);
  }

  async createUser(
    headers: IncomingHttpHeaders,
    dto: AdminCreateUserDto,
  ): Promise<AdminUserResponseDto> {
    const result = await invokeAdminApi(() =>
      auth.api.createUser({
        body: {
          email: dto.email,
          name: dto.name,
          password: dto.password,
          role: dto.role ? asAdminRole(dto.role) : undefined,
        },
        headers: this.headers(headers),
      }),
    );
    return mapUserFromResult(result);
  }

  async updateUser(
    headers: IncomingHttpHeaders,
    id: string,
    data: AdminUpdateUserDto,
  ): Promise<AdminUserResponseDto> {
    const result = await invokeAdminApi(() =>
      auth.api.adminUpdateUser({
        body: { userId: id, data },
        headers: this.headers(headers),
      }),
    );
    return mapUserFromResult(result);
  }

  async setRole(
    headers: IncomingHttpHeaders,
    id: string,
    role: string | string[],
  ): Promise<AdminUserResponseDto> {
    const result = await invokeAdminApi(() =>
      auth.api.setRole({
        body: { userId: id, role: asAdminRole(role) },
        headers: this.headers(headers),
      }),
    );
    return mapUserFromResult(result);
  }

  async ban(
    headers: IncomingHttpHeaders,
    id: string,
    opts: { banReason?: string; banExpiresIn?: number },
  ): Promise<AdminUserResponseDto> {
    const result = await invokeAdminApi(() =>
      auth.api.banUser({
        body: {
          userId: id,
          banReason: opts.banReason,
          banExpiresIn: opts.banExpiresIn,
        },
        headers: this.headers(headers),
      }),
    );
    // The ban deleted the user's session rows, delegated ones included, but
    // not the tokens cached for their credentials. Move them onto fresh keys.
    await this.delegatedSessions.invalidateForUser(id);
    return mapUserFromResult(result);
  }

  async unban(headers: IncomingHttpHeaders, id: string): Promise<AdminUserResponseDto> {
    const result = await invokeAdminApi(() =>
      auth.api.unbanUser({
        body: { userId: id },
        headers: this.headers(headers),
      }),
    );
    // Anything cached since the ban points at a row the ban deleted; without
    // this, every façade call through the user's credentials would fail until
    // the entry expired.
    await this.delegatedSessions.invalidateForUser(id);
    return mapUserFromResult(result);
  }

  async remove(headers: IncomingHttpHeaders, id: string): Promise<{ success: boolean }> {
    const result = await invokeAdminApi(() =>
      auth.api.removeUser({
        body: { userId: id },
        headers: this.headers(headers),
      }),
    );
    return mapSuccess(result);
  }

  /**
   * The user's live sessions, read from Postgres. Better Auth's
   * `listUserSessions` is still called, for the admin plugin's own permission
   * check, but its answer is not the list: with `secondaryStorage` it walks the
   * Redis index of cached sessions, which misses every session signed in
   * before the cache existed (they answer from Postgres until they expire) and
   * any whose index entry was lost. The table is the record.
   */
  async listSessions(headers: IncomingHttpHeaders, id: string): Promise<AdminSessionResponseDto[]> {
    await invokeAdminApi(() =>
      auth.api.listUserSessions({
        body: { userId: id },
        headers: this.headers(headers),
      }),
    );
    return mapSessionsFromResult(await this.sessionRows(id));
  }

  /**
   * Revoke a single session by its **id**. The Better Auth admin API revokes by
   * session token, but the session token is a live bearer credential, so it is
   * never handed to the client (see `AdminSessionResponseDto`). We resolve the
   * id to its token here, server-side, and revoke with that — the token never
   * leaves the API.
   */
  async revokeSession(
    headers: IncomingHttpHeaders,
    userId: string,
    sessionId: string,
  ): Promise<{ success: boolean }> {
    const authHeaders = this.headers(headers);
    // The permission check, as in `listSessions`; the rows come from Postgres
    // so a session the cache index never listed can be revoked too.
    await invokeAdminApi(() =>
      auth.api.listUserSessions({ body: { userId }, headers: authHeaders }),
    );
    const match = (await this.sessionRows(userId))
      .map(asRecord)
      .find((session) => String(session.id) === sessionId);
    if (!match) throw new AppError(AdminErrors.SESSION_NOT_FOUND);

    const result = await invokeAdminApi(() =>
      auth.api.revokeUserSession({
        body: { sessionToken: String(match.token) },
        headers: authHeaders,
      }),
    );
    return mapSuccess(result);
  }

  async revokeAllSessions(headers: IncomingHttpHeaders, id: string): Promise<{ success: boolean }> {
    const result = await invokeAdminApi(() =>
      auth.api.revokeUserSessions({
        body: { userId: id },
        headers: this.headers(headers),
      }),
    );
    return mapSuccess(result);
  }

  async setPassword(
    headers: IncomingHttpHeaders,
    id: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    const result = await invokeAdminApi(() =>
      auth.api.setUserPassword({
        body: { userId: id, newPassword },
        headers: this.headers(headers),
      }),
    );
    return mapSuccess(result);
  }

  /**
   * Impersonate a user. Better Auth issues a new session cookie, returned in the
   * response headers so the controller can forward the `Set-Cookie` to the client.
   */
  async impersonate(
    headers: IncomingHttpHeaders,
    id: string,
  ): Promise<{ user: AdminUserResponseDto; headers: Headers }> {
    const { response, headers: outHeaders } = await invokeAdminApi(() =>
      auth.api.impersonateUser({
        body: { userId: id },
        headers: this.headers(headers),
        returnHeaders: true,
      }),
    );
    return { user: mapUserFromResult(response), headers: outHeaders };
  }

  /** Stop impersonating and restore the admin session (also cookie-setting). */
  async stopImpersonating(
    headers: IncomingHttpHeaders,
  ): Promise<{ user: AdminUserResponseDto; headers: Headers }> {
    const { response, headers: outHeaders } = await invokeAdminApi(() =>
      auth.api.stopImpersonating({
        headers: this.headers(headers),
        returnHeaders: true,
      }),
    );
    return { user: mapUserFromResult(response), headers: outHeaders };
  }
}
