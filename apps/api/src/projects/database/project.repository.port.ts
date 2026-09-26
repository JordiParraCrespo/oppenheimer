import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { ProjectEntity } from '../domain/project.entity';

/**
 * What inserting a project came back with. The only race is the slug: another
 * project of the workspace may hold it.
 */
export type ProjectInsertOutcome = 'inserted' | 'slug-taken';

/**
 * What archiving came back with. `in-use` and `archived` both carry the project,
 * because the caller reports on it either way; `not-found` covers a project that is
 * missing and one in another workspace alike.
 */
export type ArchiveOutcome =
  | { result: 'archived' | 'in-use'; project: ProjectEntity }
  | { result: 'not-found' };

/**
 * Port for persisting and querying the project aggregate.
 *
 * Every read takes an {@link AccessScope}, which is what turns "this query is
 * authorized" from something a handler has to remember into something the
 * compiler asks for; the adapter throws rather than falling back to an
 * unfiltered query if one is ever missing.
 *
 * This deliberately does not extend `RepositoryPort<ProjectEntity>`:
 * that interface's `findAll()` and `findOneById(id)` take no scope, and offering
 * them here would reintroduce the unscoped reads the kernel exists to prevent.
 */
export interface ProjectRepositoryPort {
  /**
   * Insert a project with its repositories, in one transaction. `slug-taken` when
   * another project of the workspace holds the slug.
   */
  insert(entity: ProjectEntity): Promise<ProjectInsertOutcome>;
  /**
   * Write what a person may change — the name, the defaults, the instructions and
   * the repositories as a whole set — to a project that is still active, returning
   * the stored project.
   *
   * `None` when nothing was updated: the project is gone or archived. A targeted
   * `UPDATE … WHERE "archivedAt" IS NULL` rather than writing the whole
   * aggregate back, so a save that loaded before an archive cannot carry a
   * stale `archivedAt` over it; the repositories are replaced in the same
   * transaction, and only when that update landed.
   */
  saveSettingsIfActive(scope: AccessScope, entity: ProjectEntity): Promise<Option<ProjectEntity>>;
  /**
   * Retire a project, in one transaction with the question that decides it.
   *
   * The row is locked with `SELECT … FOR UPDATE` **before** `stillInUse` is asked
   * and stays locked until `archivedAt` is written, while creating a session takes
   * a share lock on the same row inside its own insert transaction. That is what
   * makes "an archived project holds no unresolved session" a fact rather than a
   * probability: whichever of the two waits sees the other's committed work and
   * refuses. A boolean callback rather than a value, because the answer has to be
   * read inside the lock.
   */
  archiveIfUnused(
    scope: AccessScope,
    projectId: string,
    stillInUse: () => Promise<boolean>,
  ): Promise<ArchiveOutcome>;
  /**
   * Projects the caller can reach, newest first. Archived rows are left out unless
   * asked for: a retired project keeps its slug for ever, so the listing would
   * otherwise fill with rows nobody can put work in.
   */
  findAll(scope: AccessScope, options?: { includeArchived?: boolean }): Promise<ProjectEntity[]>;
  /** `None` both for a missing project and for one outside the caller's scope. */
  findOneById(scope: AccessScope, id: string): Promise<Option<ProjectEntity>>;
}
