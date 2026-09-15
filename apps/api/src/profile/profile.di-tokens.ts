/**
 * DI tokens for the profile module. The repository is injected through a token
 * so application code depends on the `UserSettingsRepositoryPort` abstraction,
 * not the concrete TypeORM adapter.
 */
export const USER_SETTINGS_REPOSITORY = Symbol('USER_SETTINGS_REPOSITORY');

/** Read-only view of Better Auth's `session` table (`SessionReaderPort`). */
export const SESSION_READER = Symbol('SESSION_READER');
