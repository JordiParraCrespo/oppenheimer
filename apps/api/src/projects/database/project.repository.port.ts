import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { ProjectEntity } from '../domain/project.entity';

/**
 * What an insert that may lose a race came back with.
 *
 * Three outcomes rather than a boolean, because the two failures mean opposite
 * things: losing on the **origin** means somebody else created this
 * repository's project and it is the project; losing on the **slug** means a
 * different repository holds the directory name and this one needs the next
 * candidate.
 */
export type ProjectInsertOutcome = 'inserted' | 'origin-taken' | 'slug-taken';

/**
 * Port for persisting and querying the project aggregate.
 *
 * Every read takes an {@link AccessScope}, which is what turns "this query is
 * authorized" from something a handler has to remember into something the
 * compiler asks for; the adapter throws rather than falling back to an
 * unfiltered query if one is ever missing.
 *
 * As in `leads`, this deliberately does not extend `RepositoryPort<ProjectEntity>`:
 * that interface's `findAll()` and `findOneById(id)` take no scope, and offering
 * them here would reintroduce the unscoped reads the kernel exists to prevent.
 */
export interface ProjectRepositoryPort {
  /**
   * Insert the project, reporting which uniqueness rule stopped it if one did.
   *
   * `INSERT … ON CONFLICT ("organizationId", "originGithubRepoId") DO NOTHING`:
   * the statement itself answers whether this caller created the project, so no
   * second query has to assume it won. Creation raises **no domain event**, which
   * is why this is the one write that does not go through the outbox — an insert
   * that may legitimately not land cannot owe an event either way.
   */
  insertIfUnclaimed(entity: ProjectEntity): Promise<ProjectInsertOutcome>;
  /**
   * Rename a project that is still active, returning the stored row.
   *
   * `None` when nothing was updated: the project is gone or archived. A targeted
   * `UPDATE … WHERE "archivedAt" IS NULL` rather than writing the whole
   * aggregate back, so a rename that loaded before an archive cannot carry a
   * stale `archivedAt` over it.
   */
  renameIfActive(scope: AccessScope, entity: ProjectEntity): Promise<Option<ProjectEntity>>;
  /**
   * Retire a project that is still active, returning the stored row.
   *
   * `None` when nothing was updated, for the same reason as the rename above: the
   * row is the authority on whether the project is still active, and a targeted
   * `UPDATE … WHERE "archivedAt" IS NULL` cannot race with one that already ran.
   */
  archiveIfActive(scope: AccessScope, entity: ProjectEntity): Promise<Option<ProjectEntity>>;
  /**
   * Projects the caller can reach, newest first. Archived rows are left out unless
   * asked for: a retired project keeps its slug for ever, so the listing would
   * otherwise fill with rows nobody can put work in.
   */
  findAll(scope: AccessScope, options?: { includeArchived?: boolean }): Promise<ProjectEntity[]>;
  /** `None` both for a missing project and for one outside the caller's scope. */
  findOneById(scope: AccessScope, id: string): Promise<Option<ProjectEntity>>;
  /**
   * The project a repository created, by GitHub's own id.
   *
   * Archived rows are **included**, because the origin is unique per workspace and
   * the caller has to be able to tell "no project yet" from "the project for this
   * repository is retired". `ProjectLookupResolver` is what turns the second into a
   * refusal rather than a new project the constraint would reject anyway.
   */
  findOneByOrigin(scope: AccessScope, githubRepoId: string): Promise<Option<ProjectEntity>>;
}
