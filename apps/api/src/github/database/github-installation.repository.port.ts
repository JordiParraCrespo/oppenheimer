import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { GithubInstallationEntity } from '../domain/github-installation.entity';

/** What a webhook delivery changes about an installation nobody asked us about. */
export interface InstallationStatusChange {
  githubInstallationId: number;
  /** `undefined` leaves the column alone; `null` clears a suspension. */
  suspendedAt?: Date | null;
  /** Set when GitHub says the App was uninstalled. */
  deletedAt?: Date;
}

/**
 * Port for persisting and querying the installation aggregate.
 *
 * Every read a *request* makes takes an {@link AccessScope}: putting it in the
 * signature turns "this query is authorized" from something a handler has to
 * remember into something the compiler asks for. The reads that do not take one
 * are named for why — a webhook and a token mint have no caller — and are the
 * only doors past the tenant predicate.
 *
 * This deliberately does not extend `RepositoryPort`: that interface's
 * `findAll()` and `findOneById(id)` take no scope, and offering them here would
 * reintroduce exactly the unscoped reads the kernel exists to make impossible.
 */
export interface GithubInstallationRepositoryPort {
  /** Throws `GITHUB_003` rather than a driver error when the claim is taken. */
  insert(entity: GithubInstallationEntity): Promise<void>;
  save(entity: GithubInstallationEntity): Promise<GithubInstallationEntity>;
  /** Live installations the caller can reach, newest first. */
  findAll(scope: AccessScope): Promise<GithubInstallationEntity[]>;
  /** `None` for a missing, disconnected, or out-of-scope installation. */
  findOneById(scope: AccessScope, id: string): Promise<Option<GithubInstallationEntity>>;
  /**
   * The **live** row for a GitHub installation id, across every workspace.
   *
   * There is at most one, held up by a partial unique index, and that is what
   * makes a second workspace's claim a 409. Disconnected rows are history and
   * are deliberately not returned: they neither block a new claim nor deserve a
   * webhook's status write.
   */
  findLiveByGithubInstallationId(
    githubInstallationId: number,
  ): Promise<Option<GithubInstallationEntity>>;
  /**
   * This workspace's own disconnected row for a GitHub installation id, if it
   * has one — the row a reconnect revives rather than duplicating.
   */
  findDisconnectedForOrganization(
    organizationId: string,
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
  /**
   * Apply a webhook's status change with one conditional statement, touching
   * only the columns it names and only while the row is still live.
   *
   * Deliberately not a load-mutate-save of the aggregate: a delivery that read
   * the row just before a disconnect committed would write the whole aggregate
   * back, `deletedAt` included, and resurrect a claim the workspace had given
   * up. Returns whether a row matched.
   */
  applyStatusChange(change: InstallationStatusChange): Promise<boolean>;
}
