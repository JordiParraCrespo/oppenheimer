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

const UNIQUE_VIOLATION = '23505';
const SLUG_CONSTRAINT = 'UQ_project_organization_slug';

/**
 * The project aggregate's store. Every read loads the repository rows, because
 * the aggregate is not whole without them and every consumer — the listing,
 * the create path, the sidebar — prints or checks them; the two mappings
 * declare no relation, so this is where they are joined, in one query for a
 * whole listing. Every write of the rows goes through {@link saveIfActive} or
 * {@link insertIfUnclaimed}, in the same transaction as the project row, so a
 * project never exists half-saved.
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

  async insertIfUnclaimed(entity: ProjectEntity): Promise<ProjectInsertOutcome> {
    const record = this.mapper.toPersistence(entity);
    const table = this.repository.metadata.tableName;
    try {
      return await this.repository.manager.transaction(async (manager) => {
        const inserted: { id: string }[] = await manager.query(
          `INSERT INTO "${table}"
             ("id", "organizationId", "name", "slug", "originGithubRepoId", "defaultHostId", "defaultAgent")
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           -- The index is partial, so its predicate has to be repeated here or
           -- Postgres cannot infer which constraint is meant.
           ON CONFLICT ("organizationId", "originGithubRepoId")
             WHERE "originGithubRepoId" IS NOT NULL
             DO NOTHING
           RETURNING "id"`,
          [
            record.id,
            record.organizationId,
            record.name,
            record.slug,
            record.originGithubRepoId,
            record.defaultHostId,
            record.defaultAgent,
          ],
        );
        if (inserted.length === 0) return 'origin-taken';
        await this.writeRepositories(manager, entity);
        return 'inserted';
      });
    } catch (error) {
      if (isSlugConflict(error)) return 'slug-taken';
      throw error;
    }
  }

  async saveIfActive(scope: AccessScope, entity: ProjectEntity): Promise<Option<ProjectEntity>> {
    // The scope's own predicate, reused verbatim as a sub-query: an UPDATE cannot
    // carry the kernel's clauses directly, and rewriting them here by hand is how
    // a write ends up scoped differently from the reads beside it.
    const [reachable, parameters] = this.scopedQuery(scope)
      .select(`${this.alias}.id`)
      .getQueryAndParameters();
    const table = this.repository.metadata.tableName;
    const record = this.mapper.toPersistence(entity);

    return this.repository.manager.transaction(async (manager) => {
      // TypeORM's Postgres driver returns `[rows, affectedCount]` for an UPDATE.
      const [updated]: [{ id: string }[], number] = await manager.query(
        `UPDATE "${table}"
            SET "name" = $${parameters.length + 1},
                "defaultHostId" = $${parameters.length + 2},
                "defaultAgent" = $${parameters.length + 3},
                "updatedAt" = now()
          WHERE "id" = $${parameters.length + 4}
            AND "archivedAt" IS NULL
            AND "id" IN (${reachable})
          RETURNING "id"`,
        [...parameters, record.name, record.defaultHostId, record.defaultAgent, record.id],
      );
      if (updated.length === 0) return None;

      // The set is replaced rather than diffed: the dialog sends the whole list,
      // and a row's identity is the repository, which the unique on
      // (projectId, githubRepoId) already enforces.
      await manager.delete(ProjectRepositoryOrmEntity, { projectId: record.id });
      await this.writeRepositories(manager, entity);
      return Some(await this.reload(manager, record.id));
    });
  }

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
      const locked: { id: string; archivedAt: Date | null }[] = await manager.query(
        `SELECT "id", "archivedAt" FROM "${table}"
          WHERE "id" = $${parameters.length + 1} AND "id" IN (${reachable})
          FOR UPDATE`,
        [...parameters, projectId],
      );
      if (locked.length === 0) return { result: 'not-found' as const };

      const project = await this.reload(manager, projectId);
      // Already retired: nothing to ask and nothing to write, and a retried request
      // after a lost response is not a conflict.
      if (project.isArchived) return { result: 'archived' as const, project };

      if (await stillInUse()) return { result: 'in-use' as const, project };

      project.archive(new Date());
      await manager.query(
        `UPDATE "${table}" SET "archivedAt" = $2, "updatedAt" = now() WHERE "id" = $1`,
        [projectId, project.archivedAt],
      );
      return { result: 'archived' as const, project: await this.reload(manager, projectId) };
    });
  }

  async findAll(
    scope: AccessScope,
    options: { includeArchived?: boolean } = {},
  ): Promise<ProjectEntity[]> {
    const query = this.scopedQuery(scope).orderBy('project.createdAt', 'DESC');
    if (!options.includeArchived) query.andWhere('project.archivedAt IS NULL');
    return this.assemble(this.repository.manager, await query.getMany());
  }

  async findOneById(scope: AccessScope, id: string): Promise<Option<ProjectEntity>> {
    const record = await this.scopedQuery(scope).andWhere('project.id = :id', { id }).getOne();
    return this.one(record);
  }

  async findOneByOrigin(scope: AccessScope, githubRepoId: string): Promise<Option<ProjectEntity>> {
    const record = await this.scopedQuery(scope)
      .andWhere('project.originGithubRepoId = :githubRepoId', { githubRepoId })
      .getOne();
    return this.one(record);
  }

  private async one(record: ProjectOrmEntity | null): Promise<Option<ProjectEntity>> {
    if (!record) return None;
    const [project] = await this.assemble(this.repository.manager, [record]);
    return Some(project);
  }

  /** The rows of every project in the list, in one query, then each aggregate whole. */
  private async assemble(
    manager: EntityManager,
    records: ProjectOrmEntity[],
  ): Promise<ProjectEntity[]> {
    if (records.length === 0) return [];
    const rows = await manager.find(ProjectRepositoryOrmEntity, {
      where: { projectId: In(records.map((record) => record.id)) },
    });
    const byProject = new Map<string, ProjectRepositoryOrmEntity[]>();
    for (const row of rows) {
      const list = byProject.get(row.projectId) ?? [];
      list.push(row);
      byProject.set(row.projectId, list);
    }
    return records.map((record) => this.mapper.toDomain(record, byProject.get(record.id) ?? []));
  }

  private async writeRepositories(manager: EntityManager, entity: ProjectEntity): Promise<void> {
    const rows = this.mapper.repositoriesToPersistence(entity);
    if (rows.length === 0) return;
    await manager.insert(ProjectRepositoryOrmEntity, rows);
  }

  /** The aggregate as stored, inside the writing transaction so it sees its own rows. */
  private async reload(manager: EntityManager, id: string): Promise<ProjectEntity> {
    const record = await manager.findOneOrFail(ProjectOrmEntity, { where: { id } });
    const [project] = await this.assemble(manager, [record]);
    return project;
  }
}

function isSlugConflict(error: unknown): boolean {
  const driver = error as { code?: string; constraint?: string };
  return driver?.code === UNIQUE_VIOLATION && driver?.constraint === SLUG_CONSTRAINT;
}
