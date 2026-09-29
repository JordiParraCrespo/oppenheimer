/**
 * Application code injects each port through its token, so it depends on
 * `UserRepositoryPort`, never on the TypeORM adapter behind it.
 */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

/** Revokes every session an account holds (`AccountSessionsPort`). */
export const ACCOUNT_SESSIONS = Symbol('ACCOUNT_SESSIONS');
