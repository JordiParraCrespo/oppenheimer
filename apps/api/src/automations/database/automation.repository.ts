import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { isExternalTriggerSource, TRIGGER_SUBJECT_KINDS } from '@oppenheimer/shared/automations';
import { None, type Option, Some } from 'oxide.ts';
import { DataSource, type EntityManager, In, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AutomationMapper, workspaceLimitsOf } from '../automation.mapper';
import { AutomationRunMapper } from '../automation-run.mapper';
import { AutomationResource } from '../automations.resource';
import type { AutomationEntity } from '../domain/automation.entity';
import type { WatchedSubject } from '../domain/automation-read.types';
import type { AutomationRunEntity } from '../domain/automation-run.entity';
import { routineActivityEvents } from '../domain/routine-activity.policy';
import { AutomationOrmEntity } from './automation.orm-entity';
import type {
  AutomationRepositoryPort,
  DueScheduleDecision,
  FiringContext,
  TriggerCandidate,
} from './automation.repository.port';
import { AutomationRevisionOrmEntity } from './automation-revision.orm-entity';
import {
  countRecentByWorkspaceWithin,
  insertRunWithin,
  lockWorkspaceFiring,
} from './automation-run.repository';
import { AutomationSettingsOrmEntity } from './automation-settings.orm-entity';
import { AutomationTriggerOrmEntity } from './automation-trigger.orm-entity';
import { AutomationTriggerSubjectOrmEntity } from './automation-trigger-subject.orm-entity';

/**
 * The automation aggregate's store: the row, its current revision and its
 * triggers are read together and written together, so an automation never
 * exists half-saved and a trigger never points at a revision that is not there.
 */
@Injectable()
export class AutomationRepository
  extends ScopedRepositoryBase<AutomationOrmEntity>
  implements AutomationRepositoryPort
{
  protected readonly resource = AutomationResource;
  protected readonly alias = 'automation';

  constructor(
    @InjectRepository(AutomationOrmEntity)
    protected readonly repository: Repository<AutomationOrmEntity>,
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
    private readonly mapper: AutomationMapper,
    private readonly runMapper: AutomationRunMapper,
  ) {
    super();
  }

  async insert(entity: AutomationEntity): Promise<void> {
    await this.outbox.transaction(async (manager) => {
      // The revision's foreign key to the automation is checked now and the
      // automation's to its current revision at commit (deferred), so the pair
      // goes in automation first.
      await manager.insert(AutomationOrmEntity, this.mapper.toRecord(entity));
      await manager.insert(
        AutomationRevisionOrmEntity,
        this.mapper.revisionToRecord(entity) as QueryDeepPartialEntity<AutomationRevisionOrmEntity>,
      );
      await this.writeTriggers(manager, entity);
      await this.outbox.stageEvents(manager, [
        ...entity.domainEvents,
        ...routineActivityEvents(entity),
      ]);
    });
    entity.clearEvents();
  }

  async save(entity: AutomationEntity, expectedVersion: number): Promise<'saved' | 'conflict'> {
    const outcome = await this.outbox.transaction(async (manager) => {
      const record = this.mapper.toRecord(entity);
      const [updated]: [{ id: string }[], number] = await manager.query(
        `UPDATE "automation"
            SET "name" = $3, "projectId" = $4, "currentRevisionId" = $5, "pausedAt" = $6,
                "pausedReason" = $7, "deletedAt" = $8, "overlap" = $9, "maxRunsPerHour" = $10,
                "credentialScopes" = $11, "version" = "version" + 1, "updatedAt" = now()
          WHERE "id" = $1 AND "version" = $2
          RETURNING "id"`,
        [
          record.id,
          expectedVersion,
          record.name,
          record.projectId,
          record.currentRevisionId,
          record.pausedAt,
          record.pausedReason,
          record.deletedAt,
          record.overlap,
          record.maxRunsPerHour,
          // A raw jsonb parameter: the driver would send an array as a Postgres array.
          record.credentialScopes === null ? null : JSON.stringify(record.credentialScopes),
        ],
      );
      if (updated.length === 0) return 'conflict' as const;
      if (entity.hasNewRevision) {
        await manager.insert(
          AutomationRevisionOrmEntity,
          this.mapper.revisionToRecord(
            entity,
          ) as QueryDeepPartialEntity<AutomationRevisionOrmEntity>,
        );
      }
      await this.writeTriggers(manager, entity);
      await this.outbox.stageEvents(manager, [
        ...entity.domainEvents,
        ...routineActivityEvents(entity),
      ]);
      return 'saved' as const;
    });
    // A lost race staged nothing: the change it describes never happened.
    if (outcome === 'saved') entity.clearEvents();
    return outcome;
  }

  async saveForSystem(entity: AutomationEntity): Promise<void> {
    await this.save(entity, entity.version);
  }

  async findSessions(
    scope: AccessScope,
    filters: { projectId?: string },
  ): Promise<AutomationEntity[]> {
    const query = this.live(scope).andWhere(`automation.runTarget = 'session'`);
    if (filters.projectId) {
      query.andWhere('automation.projectId = :projectId', { projectId: filters.projectId });
    }
    return this.assemble(this.dataSource.manager, await query.getMany());
  }

  async findRoutinesOfBot(scope: AccessScope, botId: string): Promise<AutomationEntity[]> {
    // IDX_automation_bot.
    const query = this.live(scope).andWhere('automation.botId = :botId', { botId });
    return this.assemble(this.dataSource.manager, await query.getMany());
  }

  async findRoutines(scope: AccessScope): Promise<AutomationEntity[]> {
    const query = this.live(scope).andWhere(`automation.runTarget = 'bot'`);
    return this.assemble(this.dataSource.manager, await query.getMany());
  }

  /** The caller's live automations, oldest first: what every list narrows. */
  private live(scope: AccessScope) {
    return this.scopedQuery(scope)
      .andWhere('automation.deletedAt IS NULL')
      .orderBy('automation.createdAt', 'ASC');
  }

  async findOneById(scope: AccessScope, id: string): Promise<Option<AutomationEntity>> {
    const record = await this.scopedQuery(scope)
      .andWhere('automation.id = :id', { id })
      .andWhere('automation.deletedAt IS NULL')
      .getOne();
    return this.one(record);
  }

  async findOneByIdForSystem(id: string): Promise<Option<AutomationEntity>> {
    return this.one(await this.repository.findOneBy({ id }));
  }

  async findWatchedSubjects(source: string): Promise<WatchedSubject[]> {
    const rows: { organizationId: string; subjectRef: string; filter: unknown }[] =
      await this.dataSource.query(
        `SELECT subject."organizationId", subject."subjectRef", trigger.config -> 'filter' AS filter
         FROM automation_trigger trigger
         JOIN automation_trigger_subject subject ON subject."triggerId" = trigger.id
         JOIN automation ON automation.id = trigger."automationId"
        WHERE trigger.source = $1
          AND subject."subjectKind" = $2
          AND automation."deletedAt" IS NULL
          AND automation."pausedAt" IS NULL`,
        [source, subjectKindOf(source)],
      );
    const bySubject = new Map<string, WatchedSubject>();
    for (const row of rows) {
      const key = `${row.organizationId}:${row.subjectRef}`;
      const watched = bySubject.get(key) ?? {
        organizationId: row.organizationId,
        subjectRef: row.subjectRef,
        filters: [],
      };
      const filter = row.filter as { op?: unknown; value?: unknown } | null;
      const value =
        filter?.op === 'equals' && typeof filter.value === 'string' ? filter.value : null;
      if (!watched.filters.includes(value)) watched.filters.push(value);
      bySubject.set(key, watched);
    }
    return [...bySubject.values()];
  }

  async findEventCandidates(
    organizationId: string,
    source: string,
    eventType: string,
    subjectRef: string,
  ): Promise<TriggerCandidate[]> {
    // IDX_automation_trigger_subject_lookup finds the triggers watching the
    // subject; IDX_automation_trigger_match narrows them to this event.
    const triggers = await this.dataSource
      .getRepository(AutomationTriggerOrmEntity)
      .createQueryBuilder('trigger')
      .innerJoin(
        AutomationTriggerSubjectOrmEntity,
        'subject',
        'subject.triggerId = trigger.id AND subject.organizationId = :organizationId AND subject.subjectKind = :kind AND subject.subjectRef = :subjectRef',
        { organizationId, kind: subjectKindOf(source), subjectRef },
      )
      .innerJoin(AutomationOrmEntity, 'automation', 'automation.id = trigger.automationId')
      .where('trigger.organizationId = :organizationId', { organizationId })
      .andWhere('trigger.source = :source', { source })
      .andWhere('trigger.eventType = :eventType', { eventType })
      .andWhere('automation.deletedAt IS NULL')
      .getMany();
    if (triggers.length === 0) return [];
    const automations = await this.assemble(
      this.dataSource.manager,
      await this.repository.findBy({ id: In([...new Set(triggers.map((t) => t.automationId))]) }),
    );
    const byId = new Map(automations.map((automation) => [automation.id, automation]));
    return triggers.flatMap((record) => {
      const automation = byId.get(record.automationId);
      const trigger = automation?.triggers.find((candidate) => candidate.id === record.id);
      return automation && trigger ? [{ automation, trigger }] : [];
    });
  }

  async fireDueSchedules(
    now: Date,
    batch: number,
    since: Date,
    decide: (
      candidate: TriggerCandidate,
      scheduledFor: Date,
      context: FiringContext,
    ) => DueScheduleDecision,
    correlationId: string,
  ): Promise<AutomationRunEntity[]> {
    // Every statement of the tick runs on this transaction's connection: it
    // borrows no other from the pool while it holds the claim, and its counts
    // see the runs it has just inserted.
    return this.outbox.transaction(async (manager) => {
      // IDX_automation_trigger_due. SKIP LOCKED: two replicas ticking in the
      // same minute claim disjoint triggers, and the firing key makes a slot
      // one run even if a claim were ever repeated. NO KEY UPDATE, not UPDATE:
      // the tick only rewrites `nextFireAt`, and FOR UPDATE would conflict with
      // the KEY SHARE lock every run insert takes on its trigger through
      // FK_automation_run_trigger — an event firing, holding its workspace's
      // firing lock, would wait on this claim while the tick waits on that lock.
      const due: AutomationTriggerOrmEntity[] = await manager
        .getRepository(AutomationTriggerOrmEntity)
        .createQueryBuilder('trigger')
        .where('trigger.nextFireAt IS NOT NULL AND trigger.nextFireAt <= :now', { now })
        .orderBy('trigger.nextFireAt', 'ASC')
        .limit(batch)
        .setLock('for_no_key_update')
        .setOnLocked('skip_locked')
        .getMany();
      if (due.length === 0) return [];
      const organizationIds = [...new Set(due.map((trigger) => trigger.organizationId))].sort();
      await lockWorkspaceFiring(manager, organizationIds);
      const automations = await this.assemble(
        manager,
        await manager.findBy(AutomationOrmEntity, {
          id: In([...new Set(due.map((trigger) => trigger.automationId))]),
        }),
      );
      const settings = await manager.findBy(AutomationSettingsOrmEntity, {
        organizationId: In(organizationIds),
      });
      // Counted after the locks: a firing that committed while we waited is in it.
      const counts = await countRecentByWorkspaceWithin(manager, organizationIds, since);
      const byId = new Map(automations.map((automation) => [automation.id, automation]));
      const limitsByWorkspace = new Map(
        settings.map((record) => [record.organizationId, workspaceLimitsOf(record)]),
      );
      const runs: AutomationRunEntity[] = [];
      for (const record of due) {
        const automation = byId.get(record.automationId);
        const trigger = automation?.triggers.find((candidate) => candidate.id === record.id);
        const scheduledFor = new Date(record.nextFireAt as Date);
        const decision: DueScheduleDecision =
          automation && trigger
            ? decide({ automation, trigger }, scheduledFor, {
                workspace: limitsByWorkspace.get(automation.organizationId) ?? {},
                recent: {
                  automation: counts.byAutomation.get(automation.id) ?? 0,
                  workspace: counts.byWorkspace.get(automation.organizationId) ?? 0,
                },
              })
            : { run: null, nextFireAt: null };
        if (
          decision.run &&
          (await insertRunWithin(
            manager,
            this.outbox,
            this.runMapper,
            decision.run,
            correlationId,
          )) &&
          decision.run.isPending
        ) {
          // A queued run counts against the caps for the rest of the batch.
          const { automationId, organizationId } = decision.run;
          counts.byAutomation.set(automationId, (counts.byAutomation.get(automationId) ?? 0) + 1);
          counts.byWorkspace.set(organizationId, (counts.byWorkspace.get(organizationId) ?? 0) + 1);
          runs.push(decision.run);
        }
        await manager.query(
          `UPDATE "automation_trigger" SET "nextFireAt" = $2, "updatedAt" = now() WHERE "id" = $1`,
          [record.id, decision.nextFireAt],
        );
      }
      return runs;
    });
  }

  async findLiveOnHostForSystem(hostId: string): Promise<AutomationEntity[]> {
    const records = await this.repository
      .createQueryBuilder('automation')
      .innerJoin(
        AutomationRevisionOrmEntity,
        'revision',
        'revision.id = automation.currentRevisionId',
      )
      .where('revision.hostId = :hostId', { hostId })
      .andWhere('automation.deletedAt IS NULL')
      .getMany();
    return this.assemble(this.dataSource.manager, records);
  }

  async findLiveInProjectForSystem(
    organizationId: string,
    projectId: string,
  ): Promise<AutomationEntity[]> {
    // IDX_automation_project ("organizationId", "projectId").
    const records = await this.repository
      .createQueryBuilder('automation')
      .where('automation.organizationId = :organizationId', { organizationId })
      .andWhere('automation.projectId = :projectId', { projectId })
      .andWhere('automation.deletedAt IS NULL')
      .getMany();
    return this.assemble(this.dataSource.manager, records);
  }

  async eraseWorkspace(organizationId: string): Promise<void> {
    // Runs, revisions and triggers cascade with their automation.
    await this.repository.delete({ organizationId });
  }

  /** Replace the trigger set and its subjects. Runs keep their trigger id until it goes (SET NULL). */
  private async writeTriggers(manager: EntityManager, entity: AutomationEntity): Promise<void> {
    const kept = entity.triggers.map((trigger) => trigger.id);
    await manager
      .createQueryBuilder()
      .delete()
      .from(AutomationTriggerOrmEntity)
      .where('"automationId" = :id', { id: entity.id })
      .andWhere(kept.length > 0 ? '"id" NOT IN (:...kept)' : 'TRUE', { kept })
      .execute();
    for (const trigger of entity.triggers) {
      const row = this.mapper.triggerToRecord(entity, trigger);
      await manager.query(
        `INSERT INTO "automation_trigger"
           ("id", "organizationId", "automationId", "position", "source", "eventType", "config",
            "timezone", "nextFireAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT ("id") DO UPDATE SET
           "position" = EXCLUDED."position", "source" = EXCLUDED."source",
           "eventType" = EXCLUDED."eventType", "config" = EXCLUDED."config",
           "timezone" = EXCLUDED."timezone", "nextFireAt" = EXCLUDED."nextFireAt",
           "updatedAt" = now()`,
        [
          row.id,
          row.organizationId,
          row.automationId,
          row.position,
          row.source,
          row.eventType,
          row.config,
          row.timezone,
          row.nextFireAt,
        ],
      );
      await manager.delete(AutomationTriggerSubjectOrmEntity, { triggerId: trigger.id });
      const subjects = this.mapper.subjectsOf(trigger).map((subject) => ({
        ...subject,
        triggerId: trigger.id,
        organizationId: entity.organizationId,
      }));
      if (subjects.length > 0) await manager.insert(AutomationTriggerSubjectOrmEntity, subjects);
    }
  }

  private async one(record: AutomationOrmEntity | null): Promise<Option<AutomationEntity>> {
    if (!record) return None;
    const [entity] = await this.assemble(this.dataSource.manager, [record]);
    return entity ? Some(entity) : None;
  }

  /** Each automation whole: its current revision and its triggers, two queries for a list. */
  private async assemble(
    manager: EntityManager,
    records: AutomationOrmEntity[],
  ): Promise<AutomationEntity[]> {
    if (records.length === 0) return [];
    const [revisions, triggers] = await Promise.all([
      manager.findBy(AutomationRevisionOrmEntity, {
        id: In(records.map((record) => record.currentRevisionId)),
      }),
      manager.findBy(AutomationTriggerOrmEntity, {
        automationId: In(records.map((record) => record.id)),
      }),
    ]);
    const revisionById = new Map(revisions.map((revision) => [revision.id, revision]));
    return records.flatMap((record) => {
      const revision = revisionById.get(record.currentRevisionId);
      if (!revision) return [];
      return [
        this.mapper.toDomain(
          record,
          revision,
          triggers.filter((trigger) => trigger.automationId === record.id),
        ),
      ];
    });
  }
}

/** The subject kind a source's triggers watch; an unknown source watches nothing. */
function subjectKindOf(source: string): string {
  return isExternalTriggerSource(source) ? TRIGGER_SUBJECT_KINDS[source] : '';
}
