export const GITHUB_INSTALLATION_REPOSITORY = Symbol('GITHUB_INSTALLATION_REPOSITORY');
export const GITHUB_APP = Symbol('GITHUB_APP');
/** `RepositoryAccessPort`: a checkout's repository, and its one-hour token. */
export const REPOSITORY_ACCESS = Symbol('REPOSITORY_ACCESS');

/**
 * The `fetch` the GitHub adapter calls. Deliberately **not bound** in
 * `GithubModule`: unbound and `@Optional()`, the adapter falls back to the
 * platform `fetch`. The token exists so a test can hand it a double without
 * touching the network, and so a deployment that must route egress through a
 * client of its own has somewhere to put it.
 */
export const GITHUB_FETCH = Symbol('GITHUB_FETCH');
export const GITHUB_USER_GRANT_REPOSITORY = Symbol('GITHUB_USER_GRANT_REPOSITORY');
export const USER_TOKEN_SEALER = Symbol('USER_TOKEN_SEALER');
/** `GithubPullsPort`: GitHub's pull request endpoints, with a token the caller supplies. */
export const GITHUB_PULLS = Symbol('GITHUB_PULLS');
/**
 * `PullRequestAccessPort`: the one door the Pull requests area reaches GitHub
 * through — a workspace's repositories and pull requests, read through its
 * installations and written in the caller's own name.
 */
export const PULL_REQUEST_ACCESS = Symbol('PULL_REQUEST_ACCESS');
