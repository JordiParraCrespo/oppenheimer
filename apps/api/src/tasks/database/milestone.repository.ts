import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { None, type Option, Some } from 'oxide.ts';
import { type EntityManager, Repository, type WhereExpressionBuilder } from 'typeorm';
import type { MilestoneEntity } from '../domain/milestone.entity';
import { MilestoneMapper, type MilestoneProgress } from '../milestone.mapper';
import { PlanEventMapper } from '../plan-event.mapper';
import { TaskResource } from '../tasks.resource';
import { MilestoneOrmEntity } from './milestone.orm-entity';
import type {
  MilestoneInsertOutcome,
  MilestoneRepositoryPort,
  MilestoneWithProgress,
  MilestoneWriteOutcome,
} from './milestone.repository.port';
import { PlanEventOrmEntity } from './plan-event.orm-entity';

const UNIQUE_VIOLATION = '23505';
const IDEMPOTENCY_CONSTRAINT = 'UQ_milestone_idempotency_key';

/** The row no longer holds the version the writer named; thrown to roll the write back. */
class VersionConflict extends Error {}

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
    private readonly events: PlanEventMapper,
    private readonly outbox: OutboxService,
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

  async insert(milestone: MilestoneEntity): Promise<MilestoneInsertOutcome> {
    try {
      await this.writing(milestone, async (manager) => {
        await manager
          .getRepository(MilestoneOrmEntity)
          .insert(this.mapper.toPersistence(milestone));
      });
      return 'inserted';
    } catch (error) {
      if (!milestone.idempotencyKey || !violated(error, UNIQUE_VIOLATION, IDEMPOTENCY_CONSTRAINT)) {
        throw error;
      }
      const existing = await this.repository.findOne({
        select: { id: true },
        where: {
          organizationId: milestone.organizationId,
          idempotencyKey: milestone.idempotencyKey,
        },
      });
      if (!existing) throw error;
      return { existingId: existing.id };
    }
  }

  async save(milestone: MilestoneEntity): Promise<MilestoneWriteOutcome> {
    return this.versioned(milestone, async (manager) => {
      const query = manager
        .createQueryBuilder()
        .update(MilestoneOrmEntity)
        .set({
          name: milestone.name,
          targetDate: milestone.targetDate,
          projectId: milestone.projectId,
          version: () => 'version + 1',
        });
      return this.whereOwnRow(query, milestone).execute();
    });
  }

  async delete(milestone: MilestoneEntity): Promise<MilestoneWriteOutcome> {
    milestone.remove();
    return this.versioned(milestone, (manager) =>
      this.whereOwnRow(
        manager.createQueryBuilder().delete().from(MilestoneOrmEntity),
        milestone,
      ).execute(),
    );
  }

  /** A write that must touch exactly the milestone's row, at the version the writer named. */
  private async versioned(
    milestone: MilestoneEntity,
    write: (manager: EntityManager) => Promise<{ affected?: number | null }>,
  ): Promise<MilestoneWriteOutcome> {
    try {
      await this.writing(milestone, async (manager) => {
        if ((await write(manager)).affected !== 1) throw new VersionConflict();
      });
      return 'saved';
    } catch (error) {
      if (error instanceof VersionConflict) return 'version-conflict';
      throw error;
    }
  }

  private whereOwnRow<Q extends WhereExpressionBuilder>(query: Q, milestone: MilestoneEntity): Q {
    query.where('id = :id AND "organizationId" = :organizationId', {
      id: milestone.id,
      organizationId: milestone.organizationId,
    });
    if (milestone.expectedVersion !== null) {
      query.andWhere('version = :expected', { expected: milestone.expectedVersion });
    }
    return query;
  }

  /** The write, the changes it logs and the events it owes, in one transaction. */
  private async writing(
    milestone: MilestoneEntity,
    work: (manager: EntityManager) => Promise<void>,
  ): Promise<void> {
    try {
      await this.outbox.transaction(async (manager) => {
        await work(manager);
        const subject = {
          organizationId: milestone.organizationId,
          type: 'milestone' as const,
          id: milestone.id,
        };
        const records = milestone.changesToLog.map((change) =>
          this.events.toRecord(subject, change),
        );
        if (records.length > 0) await manager.getRepository(PlanEventOrmEntity).save(records);
        await this.outbox.stageEvents(manager, milestone.domainEvents);
      });
    } finally {
      milestone.clearEvents();
      milestone.clearChanges();
    }
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

function violated(error: unknown, code: string, constraint: string): boolean {
  const driver = (error as { driverError?: { code?: string; constraint?: string } }).driverError;
  const own = error as { code?: string; constraint?: string };
  return (
    (driver?.code ?? own.code) === code && (driver?.constraint ?? own.constraint) === constraint
  );
}
