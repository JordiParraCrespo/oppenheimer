/**
 * Application code injects each port through its token, so it depends on the
 * repository ports, never on the TypeORM adapters behind them.
 */
export const API_TOKEN_REPOSITORY = Symbol('API_TOKEN_REPOSITORY');
export const ORGANIZATION_MEMBERSHIP_READER = Symbol('ORGANIZATION_MEMBERSHIP_READER');
