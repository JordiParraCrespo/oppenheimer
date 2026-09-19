import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import type { ProjectEntity } from '../domain/project.entity';
import { ProjectMapper } from '../project.mapper';
import { ProjectResource } from '../projects.resource';
import { ProjectOrmEntity } from './project.orm-entity';
import type {
  ArchiveOutcome,
  ProjectInsertOutcome,
  ProjectRepositoryPort,
} from './project.repository.port';

/** Postgres' unique-violation class, and the constraint that guards a directory name. */
const UNIQUE_VIOLATION = '23505';
const SLUG_CONSTRAINT = 'UQ_project_organization_slug';

/**
 * TypeORM adapter for the project aggregate.
 *
 * The reads carry no tenant clause of their own: extending
 * `ScopedRepositoryBase` and naming the resource is the whole of it, so a query
 * and an `ability.can()` cannot disagree about what a scope means.
 */
@Injectable()
export class ProjectRepository
  extends ScopedRepositoryBase<ProjectOrmEntity>
  implements ProjectRepositoryPort
{
  protected readonly resource = ProjectResource;
  protected readonly alias = 'project';

  constructor(
    @InjectRepository(ProjectOrmEntity)
    protected readonly repository: Repository<ProjectOrmEntity>,
    private readonly mapper: ProjectMapper,
  ) {
    super();
  }

  /**
   * One statement, and what it comes back with is the answer.
   *
   * The conflict target is the **origin**, because that is the identity two
   * concurrent first sessions on one repository race for: `DO NOTHING` plus
   * `RETURNING` means zero rows says "somebody else created this repository's
   * project" without a second query that assumes otherwise. A **slug** collision
   * is a different event — another repository holds that directory name — and
   * arrives as the unique violation it is, so the caller knows to derive the next
   * candidate instead of adopting a stranger's project. Written as SQL because
   * both of those targets are the point of the statement.
   */
  async insertIfUnclaimed(entity: ProjectEntity): Promise<ProjectInsertOutcome> {
    const record = this.mapper.toPersistence(entity);
    const table = this.repository.metadata.tableName;
    try {
      const inserted: { id: string }[] = await this.repository.manager.query(
        `INSERT INTO "${table}" ("id", "organizationId", "name", "slug", "originGithubRepoId")
         VALUES ($1, $2, $3, $4, $5)
         -- The index is partial, so its predicate has to be repeated here or
         -- Postgres cannot infer which constraint is meant.
         ON CONFLICT ("organizationId", "originGithubRepoId")
           WHERE "originGithubRepoId" IS NOT NULL
           DO NOTHING
         RETURNING "id"`,
        [record.id, record.organizationId, record.name, record.slug, record.originGithubRepoId],
      );
      return inserted.length > 0 ? 'inserted' : 'origin-taken';
    } catch (error) {
      if (isSlugConflict(error)) return 'slug-taken';
      throw error;
    }
  }

  async renameIfActive(scope: AccessScope, entity: ProjectEntity): Promise<Option<ProjectEntity>> {
    // The scope's own predicate, reused verbatim as a sub-query: an UPDATE cannot
    // carry the kernel's clauses directly, and rewriting them here by hand is how
    // a write ends up scoped differently from the reads beside it.
    const [reachable, parameters] = this.scopedQuery(scope)
      .select(`${this.alias}.id`)
      .getQueryAndParameters();
    const table = this.repository.metadata.tableName;
    // TypeORM's Postgres driver returns `[rows, affectedCount]` for an UPDATE.
    const [updated]: [ProjectOrmEntity[], number] = await this.repository.manager.query(
      `UPDATE "${table}"
          SET "name" = $${parameters.length + 1}, "updatedAt" = now()
        WHERE "id" = $${parameters.length + 2}
          AND "archivedAt" IS NULL
          AND "id" IN (${reachable})
        RETURNING *`,
      [...parameters, entity.name, entity.id],
    );
    return updated.length > 0 ? Some(this.mapper.toDomain(updated[0])) : None;
  }

  /**
   * The lock, the question and the write, in that order and in one transaction.
   *
   * `FOR UPDATE` on the project row is what serialises this against creating a
   * session, whose insert transaction takes `FOR SHARE` on the same row: an archive
   * that commits first turns that read into zero rows, and one that arrives second
   * waits here and then sees the session it would have stranded. Asking the
   * question between the lock and the write is the whole point — a check that ran
   * before the lock could be true and stale by the time `archivedAt` lands.
   *
   * The scope's own predicate is reused verbatim as a sub-query, so a project in
   * another workspace is `not-found` here exactly as it is on every read.
   */
  async archiveIfUnused(
    scope: AccessScope,
    projectId: string,
    stillInUse: () => Promise<boolean>,
  ): Promise<ArchiveOutcome> {
    const [reachable, parameters] = this.scopedQuery(scope)
      .select(`${this.alias}.id`)
      .getQueryAndParameters();
    const table = this.repository.metadata.tableName;

    return this.repository.manager.transaction(async (manager) => {
      const locked: ProjectOrmEntity[] = await manager.query(
        `SELECT * FROM "${table}"
          WHERE "id" = $${parameters.length + 1} AND "id" IN (${reachable})
          FOR UPDATE`,
        [...parameters, projectId],
      );
      if (locked.length === 0) return { result: 'not-found' as const };

      const project = this.mapper.toDomain(locked[0]);
      // Already retired: nothing to ask and nothing to write, and a retried request
      // after a lost response is not a conflict.
      if (project.isArchived) return { result: 'archived' as const, project };

      if (await stillInUse()) return { result: 'in-use' as const, project };

      project.archive(new Date());
      const [updated]: [ProjectOrmEntity[], number] = await manager.query(
        `UPDATE "${table}" SET "archivedAt" = $2, "updatedAt" = now()
          WHERE "id" = $1
        RETURNING *`,
        [projectId, project.archivedAt],
      );
      return { result: 'archived' as const, project: this.mapper.toDomain(updated[0]) };
    });
  }

  async findAll(
    scope: AccessScope,
    options: { includeArchived?: boolean } = {},
  ): Promise<ProjectEntity[]> {
    const query = this.scopedQuery(scope).orderBy('project.createdAt', 'DESC');
    if (!options.includeArchived) query.andWhere('project.archivedAt IS NULL');
    const records = await query.getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findOneById(scope: AccessScope, id: string): Promise<Option<ProjectEntity>> {
    const record = await this.scopedQuery(scope).andWhere('project.id = :id', { id }).getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findOneByOrigin(scope: AccessScope, githubRepoId: string): Promise<Option<ProjectEntity>> {
    const record = await this.scopedQuery(scope)
      .andWhere('project.originGithubRepoId = :githubRepoId', { githubRepoId })
      .getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }
}

/** Whether a driver error is the directory-name constraint refusing the insert. */
function isSlugConflict(error: unknown): boolean {
  const driver = error as { code?: string; constraint?: string };
  return driver?.code === UNIQUE_VIOLATION && driver?.constraint === SLUG_CONSTRAINT;
}
