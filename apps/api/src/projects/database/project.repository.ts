import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import type { ProjectEntity } from '../domain/project.entity';
import { ProjectMapper } from '../project.mapper';
import { ProjectResource } from '../projects.resource';
import { ProjectOrmEntity } from './project.orm-entity';
import type { ProjectInsertOutcome, ProjectRepositoryPort } from './project.repository.port';

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

  async findAll(scope: AccessScope): Promise<ProjectEntity[]> {
    const records = await this.scopedQuery(scope)
      .andWhere('project.archivedAt IS NULL')
      .orderBy('project.createdAt', 'DESC')
      .getMany();
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
