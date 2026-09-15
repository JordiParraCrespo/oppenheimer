/**
 * DI tokens for the roles module. Repositories are injected through tokens so
 * application/domain code depends on the port abstractions, not the concrete
 * TypeORM adapters.
 */
export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');
export const USER_ROLE_REPOSITORY = Symbol('USER_ROLE_REPOSITORY');
