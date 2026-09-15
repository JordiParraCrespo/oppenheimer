import type { Role } from '@oppenheimer/shared';

/**
 * Platform-agnostic session shapes produced by `toAuthSession`. They mirror
 * the `IAuthClient` contract in `@oppenheimer/frontend` structurally, without this
 * package depending on the frontend layer.
 */
export interface AuthSessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  emailVerified: boolean;
}

export interface AuthSession {
  user: AuthSessionUser;
}

/** The slice of a Better Auth `getSession()` result the mapping reads. */
interface GetSessionResult {
  data: {
    user: {
      id: string;
      email: string;
      emailVerified: boolean;
      firstName?: string | null;
      lastName?: string | null;
      role?: string | null;
    };
  } | null;
  error: { message?: string } | null;
}

/**
 * Maps a Better Auth `getSession()` result to the `AuthSession` shape the
 * `IAuthClient` adapters return.
 *
 * Surfaces transport/server failures instead of collapsing them into `null`,
 * which would be indistinguishable from a genuinely unauthenticated user and
 * would silently sign someone out on a transient network blip.
 */
export function toAuthSession(result: GetSessionResult): AuthSession | null {
  if (result.error) {
    throw new Error(result.error.message ?? 'Failed to restore session');
  }
  if (!result.data) return null;
  const { user } = result.data;
  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      role: user.role ?? 'user',
      emailVerified: user.emailVerified,
    },
  };
}
