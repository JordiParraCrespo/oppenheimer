import type { AccessScope } from '@oppenheimer/backend-authz';

/** A repository a person watches, by the installation that reaches it. A row is a watch. */
export interface RepositoryWatch {
  installationId: string;
  githubRepoId: number;
}

/** The caller's own watches; every read and write is narrowed to the scope's person. */
export interface WatchedRepositoryRepositoryPort {
  findOwn(scope: AccessScope): Promise<RepositoryWatch[]>;
  /** Idempotent: watching a watched repository changes nothing. */
  watch(scope: AccessScope, watch: RepositoryWatch): Promise<void>;
  /** Idempotent: unwatching one with no row changes nothing. */
  unwatch(scope: AccessScope, watch: RepositoryWatch): Promise<void>;
}
