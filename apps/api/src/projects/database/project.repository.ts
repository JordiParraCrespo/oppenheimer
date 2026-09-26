import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { None, type Option, Some } from 'oxide.ts';
import { type EntityManager, In, Repository } from 'typeorm';
import type { ProjectEntity } from '../domain/project.entity';
import { ProjectMapper } from '../project.mapper';
import { ProjectResource } from '../projects.resource';
import { ProjectOrmEntity } from './project.orm-entity';
import type {
  ArchiveOutcome,
  ProjectInsertOutcome,
  ProjectRepositoryPort,
} from './project.repository.port';
import { ProjectRepositoryOrmEntity } from './project-repository.orm-entity';

/** Postgres' unique-violation class, and the constraint that guards a slug. */
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

  async insert(entity: ProjectEntity): Promise<ProjectInsertOutcome> {
    try {
      await this.repository.manager.transaction(async (manager) => {
        await manager.getRepository(ProjectOrmEntity).insert(this.mapper.toPersistence(entity));
        await this.insertRepositories(manager, entity);
      });
      return 'inserted';
    } catch (error) {
      if (isSlugConflict(error)) return 'slug-taken';
      throw error;
    }
  }

  async saveSettingsIfActive(
    scope: AccessScope,
    entity: ProjectEntity,
  ): Promise<Option<ProjectEntity>> {
    // The scope's own predicate, reused verbatim as a sub-query: an UPDATE cannot
    // carry the kernel's clauses directly, and rewriting them here by hand is how
    // a write ends up scoped differently from the reads beside it.
    const [reachable, parameters] = this.scopedQuery(scope)
      .select(`${this.alias}.id`)
      .getQueryAndParameters();
    const table = this.repository.metadata.tableName;
    const at = parameters.length;

    return this.repository.manager.transaction(async (manager) => {
      // TypeORM's Postgres driver returns `[rows, affectedCount]` for an UPDATE.
      const [updated]: [ProjectOrmEntity[], number] = await manager.query(
        `UPDATE "${table}"
            SET "name" = $${at + 1},
                "defaultHostId" = $${at + 2},
                "defaultAgent" = $${at + 3},
                "instructions" = $${at + 4},
                "updatedAt" = now()
          WHERE "id" = $${at + 5}
            AND "archivedAt" IS NULL
            AND "id" IN (${reachable})
          RETURNING *`,
        [
          ...parameters,
          entity.name,
          entity.defaultHostId,
          entity.defaultAgent,
          entity.instructions,
          entity.id,
        ],
      );
      if (updated.length === 0) return None;

      // The whole set, replaced: a project's repositories are configuration, and
      // what a session checked out lives on the session's own rows.
      await manager.getRepository(ProjectRepositoryOrmEntity).delete({ projectId: entity.id });
      const repositories = await this.insertRepositories(manager, entity);
      return Some(this.mapper.toDomain(updated[0], repositories));
    });
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

      const repositories = await this.repositoriesOf([projectId], manager);
      const project = this.mapper.toDomain(locked[0], repositories.get(projectId));
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
      return {
        result: 'archived' as const,
        project: this.mapper.toDomain(updated[0], repositories.get(projectId)),
      };
    });
  }

  async findAll(
    scope: AccessScope,
    options: { includeArchived?: boolean } = {},
  ): Promise<ProjectEntity[]> {
    const query = this.scopedQuery(scope).orderBy('project.createdAt', 'DESC');
    if (!options.includeArchived) query.andWhere('project.archivedAt IS NULL');
    const records = await query.getMany();
    const repositories = await this.repositoriesOf(records.map((record) => record.id));
    return records.map((record) => this.mapper.toDomain(record, repositories.get(record.id)));
  }

  async findOneById(scope: AccessScope, id: string): Promise<Option<ProjectEntity>> {
    const record = await this.scopedQuery(scope).andWhere('project.id = :id', { id }).getOne();
    return this.withRepositories(record);
  }

  /** One project and its repositories, read by the id the scoped read verified. */
  private async withRepositories(record: ProjectOrmEntity | null): Promise<Option<ProjectEntity>> {
    if (!record) return None;
    const repositories = await this.repositoriesOf([record.id]);
    return Some(this.mapper.toDomain(record, repositories.get(record.id)));
  }

  /**
   * The child rows of projects the caller already reached through the scoped
   * read. Never called with an id that did not come from one: the child table
   * declares no resource and carries no scoping of its own.
   */
  private async repositoriesOf(
    projectIds: readonly string[],
    manager: EntityManager = this.repository.manager,
  ): Promise<Map<string, ProjectRepositoryOrmEntity[]>> {
    const byProject = new Map<string, ProjectRepositoryOrmEntity[]>();
    if (projectIds.length === 0) return byProject;
    const rows = await manager.getRepository(ProjectRepositoryOrmEntity).find({
      where: { projectId: In([...projectIds]) },
      order: { position: 'ASC' },
    });
    for (const row of rows) {
      const list = byProject.get(row.projectId) ?? [];
      list.push(row);
      byProject.set(row.projectId, list);
    }
    return byProject;
  }

  private async insertRepositories(
    manager: EntityManager,
    entity: ProjectEntity,
  ): Promise<ProjectRepositoryOrmEntity[]> {
    const records = this.mapper.toRepositoryRecords(entity);
    if (records.length === 0) return [];
    await manager.getRepository(ProjectRepositoryOrmEntity).insert(records);
    return records;
  }
}

/** Whether a driver error is the slug constraint refusing the insert. */
function isSlugConflict(error: unknown): boolean {
  const driver = error as { code?: string; constraint?: string };
  return driver?.code === UNIQUE_VIOLATION && driver?.constraint === SLUG_CONSTRAINT;
}
