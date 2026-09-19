import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { GithubInstallationEntity } from '../domain/github-installation.entity';

/**
 * Port for persisting and querying the installation aggregate.
 *
 * Every read a *request* makes takes an {@link AccessScope}: putting it in the
 * signature turns "this query is authorized" from something a handler has to
 * remember into something the compiler asks for. The two reads that do not take
 * one are named for why — a webhook and a token mint have no caller — and are
 * the only doors past the tenant predicate.
 *
 * This deliberately does not extend `RepositoryPort`: that interface's
 * `findAll()` and `findOneById(id)` take no scope, and offering them here would
 * reintroduce exactly the unscoped reads the kernel exists to make impossible.
 */
export interface GithubInstallationRepositoryPort {
  insert(entity: GithubInstallationEntity): Promise<void>;
  save(entity: GithubInstallationEntity): Promise<GithubInstallationEntity>;
  /** Live installations the caller can reach, newest first. */
  findAll(scope: AccessScope): Promise<GithubInstallationEntity[]>;
  /** `None` for a missing, disconnected, or out-of-scope installation. */
  findOneById(scope: AccessScope, id: string): Promise<Option<GithubInstallationEntity>>;
  /**
   * By GitHub's own id, across every workspace and including disconnected rows.
   *
   * Two callers, both without a request scope to apply: the `installation`
   * webhook, which GitHub sends with no notion of our tenants, and the claim
   * check, whose whole job is to discover that *another* workspace already
   * holds this installation.
   */
  findOneByGithubInstallationId(
    githubInstallationId: number,
  ): Promise<Option<GithubInstallationEntity>>;
  /**
   * By id, with no access scope, for minting a repository token.
   *
   * A mint runs for a host rather than for a caller, so there is no request
   * scope to apply. The id is not a caller's input: it comes from a row the
   * caller already read under its own tenant scope, and the returned aggregate
   * carries `organizationId` so the caller can assert that itself.
   */
  findOneByIdForTokenMint(id: string): Promise<Option<GithubInstallationEntity>>;
}
