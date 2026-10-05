import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { OutboxService } from '@oppenheimer/backend-ddd';
import type { TaskStatus } from '@oppenheimer/shared';
import { None, type Option, Some } from 'oxide.ts';
import { type EntityManager, In, Repository } from 'typeorm';
import type { TaskEntity, TaskSessionLink } from '../domain/task.entity';
import { rankBetween } from '../domain/task-rank.policy';
import { TaskMapper } from '../task.mapper';
import { TaskResource } from '../tasks.resource';
import { TaskOrmEntity } from './task.orm-entity';
import type {
  TaskAttachOutcome,
  TaskListFilter,
  TaskPlacement,
  TaskPlaceOutcome,
  TaskRepositoryPort,
} from './task.repository.port';
import { TaskSessionOrmEntity } from './task-session.orm-entity';

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';
const RANK_CONSTRAINT = 'UQ_task_rank';
const SESSION_KEY = 'FK_task_session_session';
/** Two writers into one gap is rare; three in a row is a bug, and is reported. */
const RANK_ATTEMPTS = 3;

/** The position was not in the column; thrown inside a transaction to roll it back. */
class StalePosition extends Error {}

@Injectable()
export class TaskRepository
  extends ScopedRepositoryBase<TaskOrmEntity>
  implements TaskRepositoryPort
{
  protected readonly resource = TaskResource;
  protected readonly alias = 'task';

  constructor(
    @InjectRepository(TaskOrmEntity)
    protected readonly repository: Repository<TaskOrmEntity>,
    private readonly mapper: TaskMapper,
    private readonly outbox: OutboxService,
  ) {
    super();
  }

  async findAll(scope: AccessScope, filter: TaskListFilter): Promise<TaskEntity[]> {
    const query = this.scopedQuery(scope).orderBy('task.status').addOrderBy('task.rank');
    if (filter.projectId) query.andWhere('task.projectId = :projectId', filter);
    if (filter.goalId) query.andWhere('task.goalId = :goalId', filter);
    if (filter.dueFrom) query.andWhere('task.dueDate >= :dueFrom', filter);
    if (filter.dueTo) query.andWhere('task.dueDate <= :dueTo', filter);
    if (filter.sessionId) {
      query.andWhere(
        `task.id IN (SELECT link."taskId" FROM task_session link
                      WHERE link."organizationId" = task."organizationId"
                        AND link."sessionId" = :sessionId)`,
        filter,
      );
    }
    const records = await query.getMany();
    const links = await this.linksOf(records.map((record) => record.id));
    return records.map((record) => this.mapper.toDomain(record, links.get(record.id)));
  }

  async findOneById(scope: AccessScope, id: string): Promise<Option<TaskEntity>> {
    const record = await this.scopedQuery(scope).andWhere('task.id = :id', { id }).getOne();
    if (!record) return None;
    const links = await this.linksOf([record.id]);
    return Some(this.mapper.toDomain(record, links.get(record.id)));
  }

  insert(task: TaskEntity, placement: TaskPlacement): Promise<TaskPlaceOutcome> {
    return this.placing(async (manager) => {
      task.place(placement.status, await this.rankFor(manager, task, placement), new Date());
      await manager.getRepository(TaskOrmEntity).insert(this.mapper.toPersistence(task));
    });
  }

  async saveFields(task: TaskEntity): Promise<void> {
    await this.repository.update(
      { id: task.id, organizationId: task.organizationId },
      {
        title: task.title,
        notes: task.notes,
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        projectId: task.projectId,
        goalId: task.goalId,
      },
    );
  }

  move(task: TaskEntity, placement: TaskPlacement): Promise<TaskPlaceOutcome> {
    return this.placing(async (manager) => {
      task.place(placement.status, await this.rankFor(manager, task, placement), new Date());
      await this.writePlace(manager, task);
    });
  }

  async delete(task: TaskEntity): Promise<void> {
    await this.repository.delete({ id: task.id, organizationId: task.organizationId });
  }

  async attach(
    task: TaskEntity,
    link: TaskSessionLink,
    seenStatus: TaskStatus,
  ): Promise<TaskAttachOutcome> {
    try {
      await this.withRankRetry(() =>
        this.outbox.transaction(async (manager) => {
          // The row's status as it is now, under a lock a concurrent move waits on.
          const [locked]: { status: TaskStatus; rank: string }[] = await manager.query(
            `SELECT status, rank FROM task WHERE id = $1 AND "organizationId" = $2 FOR UPDATE`,
            [task.id, task.organizationId],
          );
          if (!locked) return;
          task.place(locked.status, locked.rank, task.updatedAt);
          await manager
            .createQueryBuilder()
            .insert()
            .into(TaskSessionOrmEntity)
            .values(this.mapper.toLinkRecord(task, link))
            .orIgnore()
            .execute();
          if (task.startsWorkOnAttach(seenStatus)) {
            const placement: TaskPlacement = { status: 'doing', after: { kind: 'first' } };
            task.place('doing', await this.rankFor(manager, task, placement), new Date());
            await this.writePlace(manager, task);
          }
          task.attach(link);
          await this.outbox.stageEvents(manager, task.domainEvents);
        }),
      );
      task.clearEvents();
      return 'attached';
    } catch (error) {
      task.clearEvents();
      if (violated(error, FOREIGN_KEY_VIOLATION, SESSION_KEY)) return 'session-not-found';
      throw error;
    }
  }

  async detach(task: TaskEntity, sessionId: string): Promise<void> {
    await this.repository.manager
      .getRepository(TaskSessionOrmEntity)
      .delete({ organizationId: task.organizationId, taskId: task.id, sessionId });
  }

  /** Run a placement in a transaction, again when another writer took the same key. */
  private async placing(
    work: (manager: EntityManager) => Promise<void>,
  ): Promise<TaskPlaceOutcome> {
    try {
      await this.withRankRetry(() => this.repository.manager.transaction(work));
      return 'placed';
    } catch (error) {
      if (error instanceof StalePosition) return 'stale-position';
      throw error;
    }
  }

  private async withRankRetry(attempt: () => Promise<void>): Promise<void> {
    for (let tries = 1; ; tries += 1) {
      try {
        return await attempt();
      } catch (error) {
        // The midpoint is read again on the next try, and the task that took
        // this key is then one of its neighbours.
        if (tries < RANK_ATTEMPTS && violated(error, UNIQUE_VIOLATION, RANK_CONSTRAINT)) continue;
        throw error;
      }
    }
  }

  /** A key for `task` at `placement`, read from the column's rows other than its own. */
  private async rankFor(
    manager: EntityManager,
    task: TaskEntity,
    placement: TaskPlacement,
  ): Promise<string> {
    const column = [task.organizationId, placement.status, task.id];
    const neighbour = async (where: string, order: 'ASC' | 'DESC', extra: unknown[] = []) => {
      const rows: { rank: string }[] = await manager.query(
        `SELECT rank FROM task
          WHERE "organizationId" = $1 AND status = $2 AND id <> $3 ${where}
          ORDER BY rank ${order} LIMIT 1`,
        [...column, ...extra],
      );
      return rows[0]?.rank ?? null;
    };

    switch (placement.after.kind) {
      case 'first':
        return rankBetween('', await neighbour('', 'ASC'));
      case 'last':
        return rankBetween((await neighbour('', 'DESC')) ?? '', null);
      case 'task': {
        const above = await neighbour('AND id = $4', 'ASC', [placement.after.taskId]);
        if (above === null) throw new StalePosition();
        return rankBetween(above, await neighbour('AND rank > $4', 'ASC', [above]));
      }
    }
  }

  private async writePlace(manager: EntityManager, task: TaskEntity): Promise<void> {
    await manager
      .getRepository(TaskOrmEntity)
      .update(
        { id: task.id, organizationId: task.organizationId },
        { status: task.status, rank: task.rank, completedAt: task.completedAt },
      );
  }

  /**
   * The links of tasks the caller already reached through the scoped read. Never
   * called with an id that did not come from one.
   */
  private async linksOf(taskIds: readonly string[]): Promise<Map<string, TaskSessionOrmEntity[]>> {
    const byTask = new Map<string, TaskSessionOrmEntity[]>();
    if (taskIds.length === 0) return byTask;
    const rows = await this.repository.manager
      .getRepository(TaskSessionOrmEntity)
      .find({ where: { taskId: In([...taskIds]) } });
    for (const row of rows) {
      const list = byTask.get(row.taskId) ?? [];
      list.push(row);
      byTask.set(row.taskId, list);
    }
    return byTask;
  }
}

function violated(error: unknown, code: string, constraint: string): boolean {
  const driver = (error as { driverError?: { code?: string; constraint?: string } }).driverError;
  const own = error as { code?: string; constraint?: string };
  return (
    (driver?.code ?? own.code) === code && (driver?.constraint ?? own.constraint) === constraint
  );
}
