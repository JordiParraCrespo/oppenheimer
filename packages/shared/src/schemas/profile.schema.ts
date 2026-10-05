import { z } from 'zod';
import { changePasswordSchema } from './auth.schema.js';

/**
 * The caller's own account: the profile fields they may edit themselves.
 *
 * Identity (email, password, OAuth links) stays owned by Better Auth and is not
 * part of the profile update: the email moves through its own request
 * (`changeEmailSchema`), which proves the new address before it is used.
 */

/** How the workspace is painted. `system` follows the OS setting. */
export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

/** Locales the workspace is translated into (mirrors `packages/translations`). */
export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];

/** Row height in data tables. */
export const TABLE_DENSITIES = ['comfortable', 'compact'] as const;
export type TableDensity = (typeof TABLE_DENSITIES)[number];

/** Image types accepted for an avatar, and the ceiling on its size. */
export const AVATAR_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type AvatarMimeType = (typeof AVATAR_MIME_TYPES)[number];
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/**
 * A username: the handle session logs and commit trailers carry. Lowercase
 * letters, digits and single hyphens between them, 1 to 39 characters — the
 * shape GitHub allows, so the same handle reads the same in both places.
 *
 * The one spelling of the rule: the user aggregate's `Username` value object
 * matches it, and the migration's CHECK quotes `USERNAME_PATTERN.source`
 * (a test holds the two equal), so it is written with no JS-only syntax.
 * The schema is the contract, so it normalises — trims and lowercases —
 * before it checks, and every door hands the domain the same value.
 */
export const USERNAME_MAX_LENGTH = 39;
export const USERNAME_PATTERN = /^[a-z0-9](-?[a-z0-9])*$/;
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(USERNAME_MAX_LENGTH)
  .regex(USERNAME_PATTERN);

/**
 * Editable profile fields. Every field is optional — the screen saves the whole
 * card, but a client may patch a single one. `phone` and `jobTitle` accept
 * `null` to clear them; omitting a field leaves it untouched.
 */
export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().min(1).max(32).nullable().optional(),
  jobTitle: z.string().min(1).max(120).nullable().optional(),
  /** Unique across accounts; `null` clears it. */
  username: usernameSchema.nullable().optional(),
});

/**
 * Asking to move the account to another address. Nothing changes until the
 * link sent to the new address is followed, so the address is proven before
 * it becomes the one used to sign in.
 */
export const changeEmailSchema = z.object({
  newEmail: z.string().email().max(254),
  /**
   * Where the link returns once followed. The client names its own screen;
   * Better Auth refuses one outside the deployment's trusted origins.
   */
  callbackURL: z.string().url().max(2048).optional(),
});

/**
 * Deleting your own account. The confirmation is the account's email typed
 * out, compared case-insensitively on the server: a destructive action that
 * cannot be undone is not one a stray click or a replayed request completes.
 */
export const deleteAccountSchema = z.object({
  confirmation: z.string().min(1).max(254),
});

/**
 * Changing your own password.
 *
 * `revokeOtherSessions` defaults to `true`: the usual reason to change a
 * password is that the old one may be known to someone else, and leaving their
 * session alive would make the change pointless. A client can opt out
 * explicitly when it knows better.
 */
export const changeOwnPasswordSchema = changePasswordSchema.extend({
  revokeOtherSessions: z.boolean().optional().default(true),
});

/**
 * Preferences are replaced wholesale (`PUT`) rather than patched: the settings
 * pane always holds every value, and a full replace means a client can never
 * half-apply a change it read before someone else's write landed.
 */
export const updateUserSettingsSchema = z.object({
  theme: z.enum(THEMES),
  locale: z.enum(LOCALES),
  density: z.enum(TABLE_DENSITIES),
  weeklyDigest: z.boolean(),
  productUpdates: z.boolean(),
});

/** Alias kept for callers that think of the whole record as "the settings". */
export const userSettingsSchema = updateUserSettingsSchema;

export const profileResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable(),
  jobTitle: z.string().nullable(),
  username: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: z.string(),
  emailVerified: z.boolean(),
  /**
   * Always `false` for now — the Better Auth `twoFactor` plugin is not enabled
   * on this deployment. Present so the settings screen can render the row in
   * its off state without branching on whether the field exists.
   */
  twoFactorEnabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const userSessionResponseSchema = z.object({
  id: z.string().uuid(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  /** True for the session the request was made with — it cannot be revoked. */
  current: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export const userSettingsResponseSchema = updateUserSettingsSchema.extend({
  userId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
export type UpdateUserSettingsDto = z.infer<typeof updateUserSettingsSchema>;
export type UserSettingsDto = UpdateUserSettingsDto;
export type UserSettingsResponse = z.infer<typeof userSettingsResponseSchema>;
export type ChangeEmailDto = z.infer<typeof changeEmailSchema>;
export type DeleteAccountDto = z.infer<typeof deleteAccountSchema>;
export type ChangeOwnPasswordDto = z.infer<typeof changeOwnPasswordSchema>;
export type ProfileResponse = z.infer<typeof profileResponseSchema>;
export type UserSessionResponse = z.infer<typeof userSessionResponseSchema>;

/**
 * The preferences a user has before they ever open the settings pane. The API
 * answers with these when no row exists yet, so a fresh account and a saved one
 * are indistinguishable to a client.
 */
export const DEFAULT_USER_SETTINGS: UpdateUserSettingsDto = {
  theme: 'system',
  locale: 'en',
  density: 'comfortable',
  weeklyDigest: true,
  productUpdates: false,
};
