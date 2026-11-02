/**
 * How a repository is reached, said by its kind rather than by an empty
 * field (`product/next-steps/0.2-pull-requests.md` §6.2):
 *
 * - `installation`: an installation of the workspace's GitHub App covers it;
 * - `tokens`: only the caller's own GitHub tokens open it, whichever one reads it.
 *
 * What only the App can do (reviews, merges, comments in the person's name,
 * review sessions, issue writes) takes an {@link InstallationAddress}, so a
 * token repository cannot reach it by type. The wire and the URL say the same
 * thing their own way (`installationId: null`, the `tokens` segment), translated
 * in one place each.
 */
export type RepositoryAddress = InstallationAddress | TokensAddress;

export interface InstallationAddress {
  kind: 'installation';
  /** The control-plane installation row's uuid. */
  installationId: string;
  githubRepoId: number;
}

export interface TokensAddress {
  kind: 'tokens';
  githubRepoId: number;
}

/** Where an address says to go, without the repository: what a route's source segment carries. */
export type RepositorySource =
  | { kind: 'installation'; installationId: string }
  | { kind: 'tokens' };
