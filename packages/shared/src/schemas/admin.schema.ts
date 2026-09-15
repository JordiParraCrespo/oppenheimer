import { z } from 'zod';

/**
 * Contracts for the Better Auth admin plugin (super-admin) operations. Used for
 * client-side form validation and shared types; the plugin exposes the actual
 * endpoints under `/api/auth/admin/*`.
 */

export const listUsersQuerySchema = z.object({
  searchValue: z.string().optional(),
  searchField: z.enum(['email', 'name']).optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional(),
  sortBy: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
});

export const setUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.union([z.string(), z.array(z.string())]),
});

export const banUserSchema = z.object({
  userId: z.string().uuid(),
  banReason: z.string().max(500).optional(),
  /** Seconds until the ban expires; omit for a permanent ban. */
  banExpiresIn: z.number().int().positive().optional(),
});

export const unbanUserSchema = z.object({
  userId: z.string().uuid(),
});

export const impersonateUserSchema = z.object({
  userId: z.string().uuid(),
});

// --- Body-only variants for the REST module (user id comes from the path) ---

export const adminCreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8).optional(),
  role: z.union([z.string(), z.array(z.string())]).optional(),
});

/** Arbitrary profile fields the admin may update (Better Auth merges `data`). */
export const adminUpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  image: z.string().url().optional(),
});

export const setUserRoleBodySchema = z.object({
  role: z.union([z.string(), z.array(z.string())]),
});

export const banUserBodySchema = z.object({
  banReason: z.string().max(500).optional(),
  /** Seconds until the ban expires; omit for a permanent ban. */
  banExpiresIn: z.number().int().positive().optional(),
});

export const setUserPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

export const adminAssignRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()),
});

export const revokeSessionSchema = z.object({
  /** Id of the session to revoke (from the admin session listing). */
  sessionId: z.string().min(1),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type SetUserRoleDto = z.infer<typeof setUserRoleSchema>;
export type BanUserDto = z.infer<typeof banUserSchema>;
export type UnbanUserDto = z.infer<typeof unbanUserSchema>;
export type ImpersonateUserDto = z.infer<typeof impersonateUserSchema>;
export type AdminCreateUserDto = z.infer<typeof adminCreateUserSchema>;
export type AdminUpdateUserDto = z.infer<typeof adminUpdateUserSchema>;
export type SetUserRoleBodyDto = z.infer<typeof setUserRoleBodySchema>;
export type BanUserBodyDto = z.infer<typeof banUserBodySchema>;
export type SetUserPasswordDto = z.infer<typeof setUserPasswordSchema>;
export type AdminAssignRolesDto = z.infer<typeof adminAssignRolesSchema>;
export type RevokeSessionDto = z.infer<typeof revokeSessionSchema>;
