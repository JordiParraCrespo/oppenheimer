import type { AccessScope } from '@oppenheimer/backend-authz';

/** A repository the caller switched on or off, by the installation that reaches it. */
export interface RepositoryWatch {
  installationId: string;
  githubRepoId: number;
  watching: boolean;
}

/** The caller's own choices; every read and write is narrowed to the scope's person. */
export interface WatchedRepositoryRepositoryPort {
  findOwn(scope: AccessScope): Promise<RepositoryWatch[]>;
  setOwn(scope: AccessScope, watch: RepositoryWatch): Promise<void>;
}
