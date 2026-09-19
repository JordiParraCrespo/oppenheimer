export const GITHUB_INSTALLATION_REPOSITORY = Symbol('GITHUB_INSTALLATION_REPOSITORY');
export const GITHUB_APP = Symbol('GITHUB_APP');
/**
 * What `sessions/` and `relay/` inject to turn a checkout into a one-hour,
 * one-repository token. Bound to `RepositoryAccessResolver`.
 */
export const REPOSITORY_ACCESS = Symbol('REPOSITORY_ACCESS');

/**
 * The `fetch` the GitHub adapter calls. Deliberately **not bound** in
 * `GithubModule`: unbound and `@Optional()`, the adapter falls back to the
 * platform `fetch`. The token exists so a test can hand it a double without
 * touching the network, and so a deployment that must route egress through a
 * client of its own has somewhere to put it.
 */
export const GITHUB_FETCH = Symbol('GITHUB_FETCH');
