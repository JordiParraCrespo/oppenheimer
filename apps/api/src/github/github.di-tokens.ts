export const GITHUB_INSTALLATION_REPOSITORY = Symbol('GITHUB_INSTALLATION_REPOSITORY');
export const GITHUB_APP = Symbol('GITHUB_APP');
/**
 * What `sessions/` and `relay/` inject to turn a checkout into a one-hour,
 * one-repository token. Bound to `RepositoryAccessResolver`.
 */
export const REPOSITORY_ACCESS = Symbol('REPOSITORY_ACCESS');
