import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxService } from '@oppenheimer/backend-ddd';
import type { TaskStatus } from '@oppenheimer/shared';
import { None, type Option, Some } from 'oxide.ts';
import { type EntityManager, In, Repository } from 'typeorm';
import { ScopedRepositoryBase } from '../../authz/database/scoped.repository';
import { type AccessScope } from '../../authz/domain/access-scope.types';
import type { TaskEntity, TaskSessionLink } from '../domain/task.entity';
import { rankBetween } from '../domain/task-rank.policy';
import { PlanEventMapper } from '../plan-event.mapper';
import { TaskMapper } from '../task.mapper';
import { TaskResource } from '../tasks.resource';
import { PlanEventOrmEntity } from './plan-event.orm-entity';
import { TaskOrmEntity } from './task.orm-entity';
import type {
  TaskAttachOutcome,
  TaskInsertOutcome,
  TaskListFilter,
  TaskMoveOutcome,
  TaskPlacement,
  TaskRepositoryPort,
  TaskWriteOutcome,
} from './task.repository.port';
import { TaskSessionOrmEntity } from './task-session.orm-entity';

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';
const RANK_CONSTRAINT = 'UQ_task_rank';
const IDEMPOTENCY_CONSTRAINT = 'UQ_task_idempotency_key';
const SESSION_KEY = 'FK_task_session_session';
/** Two writers into one gap is rare; three in a row is a bug, and is reported. */
const RANK_ATTEMPTS = 3;

/** The position was not in the column; thrown inside a transaction to roll it back. */
class StalePosition extends Error {}

/** The row no longer holds the version the writer named; thrown to roll the write back. */
class VersionConflict extends Error {}

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
    private readonly events: PlanEventMapper,
    private readonly outbox: OutboxService,
  ) {
    super();
  }

  async findAll(scope: AccessScope, filter: TaskListFilter): Promise<TaskEntity[]> {
    const query = this.scopedQuery(scope).orderBy('task.status').addOrderBy('task.rank');
    if (filter.projectId) query.andWhere('task.projectId = :projectId', filter);
    if (filter.milestoneId) query.andWhere('task.milestoneId = :milestoneId', filter);
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

  async insert(task: TaskEntity, placement: TaskPlacement): Promise<TaskInsertOutcome> {
    try {
      const outcome = await this.placing(task, async (manager) => {
        task.place(placement.status, await this.rankFor(manager, task, placement), new Date());
        await manager.getRepository(TaskOrmEntity).insert(this.mapper.toPersistence(task));
      });
      return outcome === 'version-conflict' ? 'placed' : outcome;
    } catch (error) {
      if (!task.idempotencyKey || !violated(error, UNIQUE_VIOLATION, IDEMPOTENCY_CONSTRAINT)) {
        throw error;
      }
      // A retry of a create that already landed: answer the task it made.
      const existing = await this.repository.findOne({
        select: { id: true },
        where: { organizationId: task.organizationId, idempotencyKey: task.idempotencyKey },
      });
      if (!existing) throw error;
      return { existingId: existing.id };
    }
  }

  async saveFields(task: TaskEntity): Promise<TaskWriteOutcome> {
    return this.writing(task, (manager) =>
      this.writeRow(manager, task, {
        title: task.title,
        notes: task.notes,
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        projectId: task.projectId,
        milestoneId: task.milestoneId,
        blockedReason: task.blockedReason,
        blockedAt: task.blockedAt,
      }),
    );
  }

  move(task: TaskEntity, placement: TaskPlacement): Promise<TaskMoveOutcome> {
    return this.placing(task, async (manager) => {
      task.place(placement.status, await this.rankFor(manager, task, placement), new Date());
      await this.writePlace(manager, task);
    });
  }

  async delete(task: TaskEntity): Promise<TaskWriteOutcome> {
    task.remove();
    return this.writing(task, async (manager) => {
      const query = manager
        .createQueryBuilder()
        .delete()
        .from(TaskOrmEntity)
        .where('id = :id AND "organizationId" = :organizationId', {
          id: task.id,
          organizationId: task.organizationId,
        });
      if (task.expectedVersion !== null) {
        query.andWhere('version = :expected', { expected: task.expectedVersion });
      }
      const result = await query.execute();
      if (result.affected !== 1) throw new VersionConflict();
    });
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
          task.syncPlace(locked.status, locked.rank, task.updatedAt);
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
          } else {
            await this.writeRow(manager, task, {});
          }
          task.attach(link);
          await this.logAndStage(manager, task);
        }),
      );
      task.clearEvents();
      task.clearChanges();
      return 'attached';
    } catch (error) {
      task.clearEvents();
      task.clearChanges();
      if (violated(error, FOREIGN_KEY_VIOLATION, SESSION_KEY)) return 'session-not-found';
      throw error;
    }
  }

  async detach(task: TaskEntity, sessionId: string): Promise<void> {
    task.detach();
    await this.writing(task, async (manager) => {
      await manager
        .getRepository(TaskSessionOrmEntity)
        .delete({ organizationId: task.organizationId, taskId: task.id, sessionId });
      await this.writeRow(manager, task, {});
    });
  }

  /**
   * One write in a transaction with the changes it logs and the events it owes.
   * `version-conflict` when the writer named a version the row no longer holds.
   */
  private async writing(
    task: TaskEntity,
    work: (manager: EntityManager) => Promise<void>,
  ): Promise<TaskWriteOutcome> {
    try {
      await this.outbox.transaction(async (manager) => {
        await work(manager);
        await this.logAndStage(manager, task);
      });
      return 'saved';
    } catch (error) {
      if (error instanceof VersionConflict) return 'version-conflict';
      throw error;
    } finally {
      task.clearEvents();
      task.clearChanges();
    }
  }

  /** Run a placement in a transaction, again when another writer took the same key. */
  private async placing(
    task: TaskEntity,
    work: (manager: EntityManager) => Promise<void>,
  ): Promise<'placed' | 'stale-position' | 'version-conflict'> {
    try {
      await this.withRankRetry(() =>
        this.outbox.transaction(async (manager) => {
          await work(manager);
          await this.logAndStage(manager, task);
        }),
      );
      return 'placed';
    } catch (error) {
      if (error instanceof StalePosition) return 'stale-position';
      if (error instanceof VersionConflict) return 'version-conflict';
      throw error;
    } finally {
      task.clearEvents();
      task.clearChanges();
    }
  }

  /**
   * Update the task's row and bump its version, only while it holds the version
   * the writer named when it named one.
   */
  private async writeRow(
    manager: EntityManager,
    task: TaskEntity,
    set: Partial<Omit<TaskOrmEntity, 'version'>>,
  ): Promise<void> {
    const query = manager
      .createQueryBuilder()
      .update(TaskOrmEntity)
      .set({ ...set, version: () => 'version + 1' })
      .where('id = :id AND "organizationId" = :organizationId', {
        id: task.id,
        organizationId: task.organizationId,
      });
    if (task.expectedVersion !== null) {
      query.andWhere('version = :expected', { expected: task.expectedVersion });
    }
    const result = await query.execute();
    if (result.affected !== 1) throw new VersionConflict();
  }

  /** The task's changes to `plan_event`, and its events to the outbox, on the write's manager. */
  private async logAndStage(manager: EntityManager, task: TaskEntity): Promise<void> {
    const subject = { organizationId: task.organizationId, type: 'task' as const, id: task.id };
    const records = task.changesToLog.map((change) => this.events.toRecord(subject, change));
    if (records.length > 0) await manager.getRepository(PlanEventOrmEntity).save(records);
    await this.outbox.stageEvents(manager, task.domainEvents);
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
    await this.writeRow(manager, task, {
      status: task.status,
      rank: task.rank,
      completedAt: task.completedAt,
      blockedReason: task.blockedReason,
      blockedAt: task.blockedAt,
    });
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
