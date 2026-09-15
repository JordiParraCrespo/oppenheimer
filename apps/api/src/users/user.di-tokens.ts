/**
 * DI tokens for the users module. The repository is injected through a token so
 * application/domain code depends on the `UserRepositoryPort` abstraction, not
 * the concrete TypeORM adapter.
 */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
