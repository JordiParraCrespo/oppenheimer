/**
 * Application code injects each port through its token, so it depends on the
 * repository ports, never on the TypeORM adapters behind them.
 */
export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');
export const USER_ROLE_REPOSITORY = Symbol('USER_ROLE_REPOSITORY');
export const AUTHZ_VERSION_REPOSITORY = Symbol('AUTHZ_VERSION_REPOSITORY');
