/**
 * DI tokens for the profile module. The repository is injected through a token
 * so application code depends on the `UserSettingsRepositoryPort` abstraction,
 * not the concrete TypeORM adapter.
 */
export const USER_SETTINGS_REPOSITORY = Symbol('USER_SETTINGS_REPOSITORY');

/** Read-only view of Better Auth's `session` table (`SessionReaderPort`). */
export const SESSION_READER = Symbol('SESSION_READER');

/** Where an avatar is kept and how a stored value becomes a URL. */
export const AVATAR_STORAGE = Symbol('AVATAR_STORAGE');

/** Password changes and session revocation for the caller's own account. */
export const PROFILE_AUTH = Symbol('PROFILE_AUTH');

/** Which language to write to someone who is not making a request. */
export const LOCALE_RESOLVER = Symbol('LOCALE_RESOLVER');
