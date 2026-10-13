import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import type { MilestoneEntity } from '../domain/milestone.entity';
import { MilestoneMapper, type MilestoneProgress } from '../milestone.mapper';
import { TaskResource } from '../tasks.resource';
import { MilestoneOrmEntity } from './milestone.orm-entity';
import type { MilestoneRepositoryPort, MilestoneWithProgress } from './milestone.repository.port';

/** Milestones are read under the board's resource: they group tasks and have no access of their own. */
@Injectable()
export class MilestoneRepository
  extends ScopedRepositoryBase<MilestoneOrmEntity>
  implements MilestoneRepositoryPort
{
  protected readonly resource = TaskResource;
  protected readonly alias = 'milestone';

  constructor(
    @InjectRepository(MilestoneOrmEntity)
    protected readonly repository: Repository<MilestoneOrmEntity>,
    private readonly mapper: MilestoneMapper,
  ) {
    super();
  }

  async findAll(
    scope: AccessScope,
    filter: { projectId?: string },
  ): Promise<MilestoneWithProgress[]> {
    const query = this.scopedQuery(scope).orderBy('milestone.createdAt').addOrderBy('milestone.id');
    if (filter.projectId) query.andWhere('milestone.projectId = :projectId', filter);
    const records = await query.getMany();
    const progress = await this.progressByMilestone(records);
    return records.map((record) => ({
      milestone: this.mapper.toDomain(record),
      progress: progress.get(record.id) ?? { done: 0, total: 0 },
    }));
  }

  async findOneById(scope: AccessScope, id: string): Promise<Option<MilestoneEntity>> {
    const record = await this.scopedQuery(scope).andWhere('milestone.id = :id', { id }).getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async progressOf(milestone: MilestoneEntity): Promise<MilestoneProgress> {
    return (await this.progressByMilestone([milestone])).get(milestone.id) ?? { done: 0, total: 0 };
  }

  async insert(milestone: MilestoneEntity): Promise<void> {
    await this.repository.insert(this.mapper.toPersistence(milestone));
  }

  async save(milestone: MilestoneEntity): Promise<void> {
    await this.repository.update(
      { id: milestone.id, organizationId: milestone.organizationId },
      { name: milestone.name, targetDate: milestone.targetDate, projectId: milestone.projectId },
    );
  }

  async delete(milestone: MilestoneEntity): Promise<void> {
    await this.repository.delete({ id: milestone.id, organizationId: milestone.organizationId });
  }

  /** Counted from milestones the caller already reached; served by `IDX_task_milestone`. */
  private async progressByMilestone(
    milestones: readonly { id: string; organizationId: string }[],
  ): Promise<Map<string, MilestoneProgress>> {
    const byMilestone = new Map<string, MilestoneProgress>();
    if (milestones.length === 0) return byMilestone;
    const rows: { milestoneId: string; done: string; total: string }[] =
      await this.repository.query(
        `SELECT "milestoneId", count(*) FILTER (WHERE status = 'done') AS done, count(*) AS total
         FROM task
        WHERE ("organizationId", "milestoneId") IN (SELECT * FROM unnest($1::uuid[], $2::uuid[]))
        GROUP BY "milestoneId"`,
        [
          milestones.map((milestone) => milestone.organizationId),
          milestones.map((milestone) => milestone.id),
        ],
      );
    for (const row of rows) {
      byMilestone.set(row.milestoneId, { done: Number(row.done), total: Number(row.total) });
    }
    return byMilestone;
  }
}
