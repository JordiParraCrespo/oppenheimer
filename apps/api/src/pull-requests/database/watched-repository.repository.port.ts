import type { AccessScope } from '@oppenheimer/backend-authz';
import type { RepositoryAddress } from '../../github/domain/repository-address.types';

/**
 * A repository a person watches: by the installation that reaches it, or
 * through their own tokens, whichever token reads it. A row is a watch.
 */
export type RepositoryWatch = RepositoryAddress;

/** The caller's own watches; every read and write is narrowed to the scope's person. */
export interface WatchedRepositoryRepositoryPort {
  findOwn(scope: AccessScope): Promise<RepositoryWatch[]>;
  /** Idempotent: watching a watched repository changes nothing. */
  watch(scope: AccessScope, watch: RepositoryWatch): Promise<void>;
  /** Idempotent: unwatching one with no row changes nothing. */
  unwatch(scope: AccessScope, watch: RepositoryWatch): Promise<void>;
}
