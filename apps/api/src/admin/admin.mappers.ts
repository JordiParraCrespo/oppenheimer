import { asArray, asRecord, unwrap, unwrapArray } from '../auth/infrastructure/better-auth.util';
import type {
  AdminSessionResponseDto,
  AdminUserListResponseDto,
  AdminUserResponseDto,
} from './dtos/admin-user.response.dto';

/**
 * Pure mappers from Better Auth admin-plugin API results to the module's
 * response DTOs. Every mapper accepts `unknown` and narrows once via `asRecord`
 * / `unwrap`, so `AdminService` never carries `as`-casts; all response
 * normalization (coercion, `{ user }` / `{ sessions }` envelope unwrapping,
 * date parsing) lives here.
 */

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(value as string);
}
function toDateOrNull(value: unknown): Date | null {
  return value == null ? null : toDate(value);
}
function toNumberOrNull(value: unknown): number | null {
  return value == null ? null : Number(value);
}

export function mapUser(input: unknown): AdminUserResponseDto {
  const u = asRecord(input);
  return {
    id: String(u.id),
    email: String(u.email),
    name: String(u.name ?? ''),
    role: (u.role as string | null) ?? null,
    emailVerified: Boolean(u.emailVerified),
    banned: Boolean(u.banned),
    banReason: (u.banReason as string | null) ?? null,
    banExpires: toDateOrNull(u.banExpires),
    createdAt: toDate(u.createdAt),
  };
}

export function mapSession(input: unknown): AdminSessionResponseDto {
  const s = asRecord(input);
  return {
    id: String(s.id),
    userId: String(s.userId),
    expiresAt: toDate(s.expiresAt),
    ipAddress: (s.ipAddress as string | null) ?? null,
    userAgent: (s.userAgent as string | null) ?? null,
    createdAt: toDate(s.createdAt),
  };
}

/** Unwrap a `{ user }` envelope (or use the root object) and map. */
export const mapUserFromResult = (input: unknown): AdminUserResponseDto =>
  mapUser(unwrap(input, 'user'));

/** Map the paginated list result `{ users, total, limit, offset }`. */
export function mapUserList(input: unknown): AdminUserListResponseDto {
  const r = asRecord(input);
  return {
    users: asArray(r.users).map(mapUser),
    total: Number(r.total ?? 0),
    limit: toNumberOrNull(r.limit),
    offset: toNumberOrNull(r.offset),
  };
}

/** Map a `{ sessions }` envelope to a list of sessions. */
export const mapSessionsFromResult = (input: unknown): AdminSessionResponseDto[] =>
  unwrapArray(input, 'sessions').map(mapSession);

/** Read a Better Auth success/status boolean flag. */
export function mapSuccess(input: unknown): { success: boolean } {
  const r = asRecord(input);
  return { success: Boolean(r.success ?? r.status) };
}
