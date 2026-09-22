/**
 * DI tokens for the organizations module. The repository is injected through a
 * token so application code depends on the port abstraction, not the concrete
 * TypeORM adapter.
 */
export const PERSONAL_WORKSPACE_REPOSITORY = Symbol('PERSONAL_WORKSPACE_REPOSITORY');
export const WORKSPACE_LOOKUP = Symbol('WORKSPACE_LOOKUP');
