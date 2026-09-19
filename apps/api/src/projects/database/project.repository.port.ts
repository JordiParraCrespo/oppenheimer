import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { ProjectEntity } from '../domain/project.entity';

/** What a listing hides unless it is asked for. */
export interface FindProjectsParams {
  /** Archived projects are tombstones; a listing leaves them out by default. */
  includeArchived: boolean;
}

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
   * Insert the project unless its slug is already taken in the workspace,
   * reporting whether the row landed.
   *
   * One statement — `INSERT … ON CONFLICT (organizationId, slug) DO NOTHING` —
   * because two concurrent first sessions on the same repository both try it,
   * and a check-then-insert would have both of them believe they won.
   */
  insertIfSlugAvailable(entity: ProjectEntity): Promise<boolean>;
  save(entity: ProjectEntity): Promise<ProjectEntity>;
  /** Projects the caller can reach, newest first. */
  findAll(scope: AccessScope, params: FindProjectsParams): Promise<ProjectEntity[]>;
  /** `None` both for a missing project and for one outside the caller's scope. */
  findOneById(scope: AccessScope, id: string): Promise<Option<ProjectEntity>>;
  /**
   * The project a repository created, by GitHub's own id.
   *
   * Archived projects are **included**: the slug is a permanent directory name,
   * so a second project for the same repository would have to live in a
   * suffixed directory beside the first one's history rather than replace it.
   */
  findOneByOrigin(scope: AccessScope, githubRepoId: number): Promise<Option<ProjectEntity>>;
}
