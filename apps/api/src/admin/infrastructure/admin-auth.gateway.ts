import type { IncomingHttpHeaders } from 'node:http';
import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import type { AdminCreateUserDto, AdminUpdateUserDto, ListUsersQuery } from '@oppenheimer/shared';
import { DELEGATED_SESSION } from '../../auth/auth.di-tokens';
import { auth } from '../../auth/infrastructure/better-auth.config';
import { asRecord, betterAuthHeaders } from '../../auth/infrastructure/better-auth.util';
import type { DelegatedSessionPort } from '../../auth/infrastructure/delegated-session.port';
import { AdminUserMapper } from '../admin-user.mapper';
import { AdminErrors } from '../domain/admin.errors';
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

/** How many session rows are read at a time; the list reads every page. */
const SESSION_PAGE = 500;

type SessionAction = 'list' | 'revoke';

/**
 * The admin port, over the Better Auth **admin** plugin (`auth.api.*`). Every
 * call goes through `invokeAdminApi` (see `betterAuthInvoker`).
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

  async createUser(headers: IncomingHttpHeaders, input: AdminCreateUserDto): Promise<string> {
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
    return AdminUserMapper.fromEnvelope(result).id;
  }

  async updateUser(
    headers: IncomingHttpHeaders,
    userId: string,
    data: AdminUpdateUserDto,
  ): Promise<void> {
    await invokeAdminApi(() =>
      auth.api.adminUpdateUser({
        body: { userId, data },
        headers: betterAuthHeaders(headers),
      }),
    );
  }

  async setRole(
    headers: IncomingHttpHeaders,
    userId: string,
    role: string | string[],
  ): Promise<void> {
    await invokeAdminApi(() =>
      auth.api.setRole({
        body: { userId, role: asAdminRole(role) },
        headers: betterAuthHeaders(headers),
      }),
    );
  }

  async ban(headers: IncomingHttpHeaders, userId: string, input: BanInput): Promise<void> {
    await invokeAdminApi(() =>
      auth.api.banUser({
        body: { userId, banReason: input.banReason, banExpiresIn: input.banExpiresIn },
        headers: betterAuthHeaders(headers),
      }),
    );
    // The ban deleted the user's session rows, delegated ones included, but
    // not the tokens cached for their credentials. Move them onto fresh keys.
    await this.delegatedSessions.invalidateForUser(userId);
  }

  async unban(headers: IncomingHttpHeaders, userId: string): Promise<void> {
    await invokeAdminApi(() =>
      auth.api.unbanUser({ body: { userId }, headers: betterAuthHeaders(headers) }),
    );
    // Anything cached since the ban points at a row the ban deleted; without
    // this, every façade call through the user's credentials would fail until
    // the entry expired.
    await this.delegatedSessions.invalidateForUser(userId);
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
   * `listUserSessions` is not the list: with `secondaryStorage` it walks the
   * Redis index of cached sessions, which misses every session signed in
   * before the cache existed (they answer from Postgres until they expire) and
   * any whose index entry was lost. The table is the record, read to the end.
   */
  async listSessions(
    headers: IncomingHttpHeaders,
    userId: string,
  ): Promise<AdminSessionResponseDto[]> {
    await this.assertMay(headers, 'list');
    const context = await auth.$context;
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; ; offset += SESSION_PAGE) {
      const page = await context.adapter.findMany<Record<string, unknown>>({
        model: 'session',
        where: [
          { field: 'userId', value: userId },
          { field: 'expiresAt', value: new Date(), operator: 'gt' },
        ],
        sortBy: { field: 'createdAt', direction: 'desc' },
        // Better Auth caps `findMany` at 100 unless told otherwise.
        limit: SESSION_PAGE,
        offset,
      });
      rows.push(...page);
      if (page.length < SESSION_PAGE) break;
    }
    return AdminUserMapper.toSessionsResponse(rows);
  }

  /**
   * The row is found by its id and its owner, straight from the table — so a
   * session the cache index never listed can be revoked, and no list stands
   * between the id and the row — and revoked with its token, which never
   * leaves this method.
   */
  async revokeSessionById(
    headers: IncomingHttpHeaders,
    userId: string,
    sessionId: string,
  ): Promise<AdminSuccessResponseDto> {
    await this.assertMay(headers, 'revoke');
    const context = await auth.$context;
    const row = await context.adapter.findOne<Record<string, unknown>>({
      model: 'session',
      where: [
        { field: 'id', value: sessionId },
        { field: 'userId', value: userId },
        { field: 'expiresAt', value: new Date(), operator: 'gt' },
      ],
    });
    if (!row) throw new AppError(AdminErrors.SESSION_NOT_FOUND);

    const result = await invokeAdminApi(() =>
      auth.api.revokeUserSession({
        body: { sessionToken: String(asRecord(row).token) },
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

  async impersonate(headers: IncomingHttpHeaders, userId: string): Promise<string[]> {
    const { headers: outHeaders } = await invokeAdminApi(() =>
      auth.api.impersonateUser({
        body: { userId },
        headers: betterAuthHeaders(headers),
        returnHeaders: true,
      }),
    );
    return outHeaders.getSetCookie();
  }

  async stopImpersonating(headers: IncomingHttpHeaders): Promise<IssuedSession> {
    const { response, headers: outHeaders } = await invokeAdminApi(() =>
      auth.api.stopImpersonating({ headers: betterAuthHeaders(headers), returnHeaders: true }),
    );
    return { user: AdminUserMapper.fromEnvelope(response), cookies: outHeaders.getSetCookie() };
  }

  /**
   * The admin plugin's own answer to whether the caller may do this to
   * sessions, asked as a question rather than inferred from a list call whose
   * rows would be thrown away.
   */
  private async assertMay(headers: IncomingHttpHeaders, action: SessionAction): Promise<void> {
    const result = await invokeAdminApi(() =>
      auth.api.userHasPermission({
        body: { permissions: { session: [action] } },
        headers: betterAuthHeaders(headers),
      }),
    );
    if (!asRecord(result).success) throw new AppError(AdminErrors.NOT_ALLOWED);
  }
}
