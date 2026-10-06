import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import type { GoalEntity } from '../domain/goal.entity';
import { GoalMapper, type GoalProgress } from '../goal.mapper';
import { TaskResource } from '../tasks.resource';
import { GoalOrmEntity } from './goal.orm-entity';
import type { GoalRepositoryPort, GoalWithProgress } from './goal.repository.port';

/** Goals are read under the board's resource: they group tasks and have no access of their own. */
@Injectable()
export class GoalRepository
  extends ScopedRepositoryBase<GoalOrmEntity>
  implements GoalRepositoryPort
{
  protected readonly resource = TaskResource;
  protected readonly alias = 'goal';

  constructor(
    @InjectRepository(GoalOrmEntity)
    protected readonly repository: Repository<GoalOrmEntity>,
    private readonly mapper: GoalMapper,
  ) {
    super();
  }

  async findAll(scope: AccessScope, filter: { projectId?: string }): Promise<GoalWithProgress[]> {
    const query = this.scopedQuery(scope).orderBy('goal.createdAt').addOrderBy('goal.id');
    if (filter.projectId) query.andWhere('goal.projectId = :projectId', filter);
    const records = await query.getMany();
    const progress = await this.progressByGoal(records);
    return records.map((record) => ({
      goal: this.mapper.toDomain(record),
      progress: progress.get(record.id) ?? { done: 0, total: 0 },
    }));
  }

  async findOneById(scope: AccessScope, id: string): Promise<Option<GoalEntity>> {
    const record = await this.scopedQuery(scope).andWhere('goal.id = :id', { id }).getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async progressOf(goal: GoalEntity): Promise<GoalProgress> {
    return (await this.progressByGoal([goal])).get(goal.id) ?? { done: 0, total: 0 };
  }

  async insert(goal: GoalEntity): Promise<void> {
    await this.repository.insert(this.mapper.toPersistence(goal));
  }

  async save(goal: GoalEntity): Promise<void> {
    await this.repository.update(
      { id: goal.id, organizationId: goal.organizationId },
      { name: goal.name, targetDate: goal.targetDate, projectId: goal.projectId },
    );
  }

  async delete(goal: GoalEntity): Promise<void> {
    await this.repository.delete({ id: goal.id, organizationId: goal.organizationId });
  }

  /** Counted from goals the caller already reached; served by `IDX_task_goal`. */
  private async progressByGoal(
    goals: readonly { id: string; organizationId: string }[],
  ): Promise<Map<string, GoalProgress>> {
    const byGoal = new Map<string, GoalProgress>();
    if (goals.length === 0) return byGoal;
    const rows: { goalId: string; done: string; total: string }[] = await this.repository.query(
      `SELECT "goalId", count(*) FILTER (WHERE status = 'done') AS done, count(*) AS total
         FROM task
        WHERE ("organizationId", "goalId") IN (SELECT * FROM unnest($1::uuid[], $2::uuid[]))
        GROUP BY "goalId"`,
      [goals.map((goal) => goal.organizationId), goals.map((goal) => goal.id)],
    );
    for (const row of rows) {
      byGoal.set(row.goalId, { done: Number(row.done), total: Number(row.total) });
    }
    return byGoal;
  }
}
