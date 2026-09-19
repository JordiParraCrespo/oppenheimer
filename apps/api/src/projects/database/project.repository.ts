import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import type { ProjectEntity } from '../domain/project.entity';
import { ProjectMapper } from '../project.mapper';
import { ProjectResource } from '../projects.resource';
import { ProjectOrmEntity } from './project.orm-entity';
import type { FindProjectsParams, ProjectRepositoryPort } from './project.repository.port';

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
    private readonly outbox: OutboxService,
  ) {
    super();
  }

  /**
   * One statement, and the row count is the answer.
   *
   * `ON CONFLICT … DO NOTHING` with a `RETURNING` clause returns a row only when
   * the insert landed, so the caller learns whether it won the race from the
   * write itself rather than from a second query that assumes it did. Written as
   * SQL rather than through the query builder because the conflict target is the
   * point of the statement and belongs in plain sight.
   */
  async insertIfSlugAvailable(entity: ProjectEntity): Promise<boolean> {
    const record = this.mapper.toPersistence(entity);
    const table = this.repository.metadata.tableName;
    const inserted: { id: string }[] = await this.repository.manager.query(
      `INSERT INTO "${table}" ("id", "organizationId", "name", "slug", "originGithubRepoId")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("organizationId", "slug") DO NOTHING
       RETURNING "id"`,
      [record.id, record.organizationId, record.name, record.slug, record.originGithubRepoId],
    );
    return inserted.length > 0;
  }

  async save(entity: ProjectEntity): Promise<ProjectEntity> {
    const record = await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository(ProjectOrmEntity).save(this.mapper.toPersistence(entity)),
    );
    return this.mapper.toDomain(record);
  }

  async findAll(scope: AccessScope, params: FindProjectsParams): Promise<ProjectEntity[]> {
    const query = this.scopedQuery(scope).orderBy('project.createdAt', 'DESC');
    if (!params.includeArchived) query.andWhere('project.archivedAt IS NULL');
    const records = await query.getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findOneById(scope: AccessScope, id: string): Promise<Option<ProjectEntity>> {
    const record = await this.scopedQuery(scope).andWhere('project.id = :id', { id }).getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findOneByOrigin(scope: AccessScope, githubRepoId: number): Promise<Option<ProjectEntity>> {
    const record = await this.scopedQuery(scope)
      // The parameter is bound as a string, which is how the driver exchanges a
      // bigint; Postgres compares it as the number it is.
      .andWhere('project.originGithubRepoId = :githubRepoId', {
        githubRepoId: String(githubRepoId),
      })
      .getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }
}
