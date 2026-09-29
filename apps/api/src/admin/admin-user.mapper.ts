import { asArray, asRecord, unwrap, unwrapArray } from '../auth/infrastructure/better-auth.util';
import type {
  AdminSessionResponseDto,
  AdminSuccessResponseDto,
  AdminUserListResponseDto,
  AdminUserResponseDto,
} from './dtos/admin-user.response.dto';

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(value as string);
}
function toDateOrNull(value: unknown): Date | null {
  return value == null ? null : toDate(value);
}
function toNumberOrNull(value: unknown): number | null {
  return value == null ? null : Number(value);
}

/**
 * Maps what the Better Auth admin plugin returns onto this module's response
 * DTOs. Better Auth owns the `user` and `session` tables, so there is no
 * aggregate here to map to and from — only the plugin's untyped results to
 * narrow. Every method accepts `unknown` and narrows once via `asRecord` /
 * `unwrap`, so the gateway carries no `as`-casts; all response normalization
 * (coercion, `{ user }` / `{ sessions }` envelope unwrapping, date parsing)
 * lives here.
 */
export class AdminUserMapper {
  static toResponse(input: unknown): AdminUserResponseDto {
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

  /** Unwrap a `{ user }` envelope (or use the root object) and map. */
  static fromEnvelope(input: unknown): AdminUserResponseDto {
    return AdminUserMapper.toResponse(unwrap(input, 'user'));
  }

  /** Map the paginated list result `{ users, total, limit, offset }`. */
  static toListResponse(input: unknown): AdminUserListResponseDto {
    const r = asRecord(input);
    return {
      users: asArray(r.users).map(AdminUserMapper.toResponse),
      total: Number(r.total ?? 0),
      limit: toNumberOrNull(r.limit),
      offset: toNumberOrNull(r.offset),
    };
  }

  static toSessionResponse(input: unknown): AdminSessionResponseDto {
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

  /** Map a `{ sessions }` envelope (or a bare array) to a list of sessions. */
  static toSessionsResponse(input: unknown): AdminSessionResponseDto[] {
    return unwrapArray(input, 'sessions').map(AdminUserMapper.toSessionResponse);
  }

  /** Read a Better Auth success/status boolean flag. */
  static toSuccess(input: unknown): AdminSuccessResponseDto {
    const r = asRecord(input);
    return { success: Boolean(r.success ?? r.status) };
  }
}
