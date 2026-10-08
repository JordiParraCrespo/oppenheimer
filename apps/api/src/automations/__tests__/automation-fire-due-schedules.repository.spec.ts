import type { OutboxService } from '@oppenheimer/backend-ddd';
import type { DataSource, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { AutomationMapper } from '../automation.mapper';
import type { AutomationRunMapper } from '../automation-run.mapper';
import { AutomationOrmEntity } from '../database/automation.orm-entity';
import { AutomationRepository } from '../database/automation.repository';
import type { FiringContext } from '../database/automation.repository.port';
import { AutomationRevisionOrmEntity } from '../database/automation-revision.orm-entity';
import { AutomationSettingsOrmEntity } from '../database/automation-settings.orm-entity';
import { AutomationTriggerOrmEntity } from '../database/automation-trigger.orm-entity';
import { AutomationEntity } from '../domain/automation.entity';
import { AutomationRunEntity } from '../domain/automation-run.entity';
import { triggerFromInput } from '../domain/trigger-config.policy';

const now = new Date('2026-09-27T10:00:00Z');
const since = new Date('2026-09-27T09:00:00Z');

function scheduled(name: string) {
  return AutomationEntity.createNew({
    organizationId: 'org-1',
    projectId: 'project-1',
    ownerUserId: 'user-1',
    name,
    revision: {
      hostId: 'host-1',
      agent: 'claude-code',
      model: 'claude-sonnet-5',
      permission: 'auto',
      effort: null,
      prompt: 'Audit the manifests.',
      repositories: [{ installationId: 'inst-1', githubRepoId: '101', fullName: 'acme/atlas' }],
      createdByUserId: 'user-1',
    },
    triggers: [
      triggerFromInput(
        { source: 'schedule', frequency: 'hourly', hour: 0, minute: 0, timezone: 'Europe/Madrid' },
        0,
      ),
    ],
    active: true,
    now,
  });
}

const outside = () => {
  throw new Error('used a pool connection outside the tick transaction');
};

/**
 * A DataSource whose only working door is `transaction()`: any statement the
 * tick issued on another pool connection while it holds the claim throws.
 */
function harness() {
  const automations = [scheduled('One'), scheduled('Two')];
  const due = automations.map((automation) => ({
    id: automation.triggers[0].id,
    organizationId: automation.organizationId,
    automationId: automation.id,
    nextFireAt: now,
  }));
  const statements: string[] = [];
  const locks: string[] = [];
  const builder = {
    where: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    setLock: (mode: string) => {
      locks.push(mode);
      return builder;
    },
    setOnLocked: (mode: string) => {
      locks.push(mode);
      return builder;
    },
    getMany: async () => due,
  };
  const manager = {
    getRepository: (entity: unknown) => {
      expect(entity).toBe(AutomationTriggerOrmEntity);
      return { createQueryBuilder: () => builder };
    },
    findBy: async (entity: unknown) => {
      statements.push(`findBy ${(entity as { name: string }).name}`);
      if (entity === AutomationOrmEntity) {
        return automations.map((automation) => ({
          id: automation.id,
          organizationId: automation.organizationId,
          currentRevisionId: automation.revision.id,
        }));
      }
      if (entity === AutomationRevisionOrmEntity) {
        return automations.map((automation) => ({ id: automation.revision.id }));
      }
      if (entity === AutomationSettingsOrmEntity) {
        return [{ organizationId: 'org-1', maxRunsPerWorkspaceHour: 3, overlap: 'queue' }];
      }
      return [];
    },
    query: async (sql: string) => {
      statements.push(sql);
      if (sql.includes('GROUPING SETS')) {
        return [
          { organizationId: 'org-1', automationId: null, count: '2' },
          { organizationId: 'org-1', automationId: automations[0].id, count: '2' },
        ];
      }
      if (sql.includes('INSERT INTO "automation_run"')) return [{ id: 'inserted' }];
      return [];
    },
  };
  const dataSource = {
    transaction: async (work: (m: typeof manager) => Promise<unknown>) => work(manager),
    get manager() {
      return outside();
    },
    query: outside,
    getRepository: outside,
    createQueryBuilder: outside,
  } as unknown as DataSource;
  // The outbox's transaction is the tick's: it opens the one the harness
  // allows, and waking after commit is `OutboxService`'s own concern.
  const outbox = {
    transaction: vi.fn((work: (m: typeof manager) => Promise<unknown>) =>
      dataSource.transaction(work as never),
    ),
    stageJob: vi.fn(async () => undefined),
    stageEvents: vi.fn(async () => undefined),
  };
  const mapper = {
    toDomain: (record: { id: string }) => automations.find((a) => a.id === record.id),
  } as unknown as AutomationMapper;
  const runMapper = {
    toRecord: (run: AutomationRunEntity) => ({ id: run.id }),
  } as unknown as AutomationRunMapper;
  const repository = new AutomationRepository(
    new Proxy({}, { get: outside }) as Repository<AutomationOrmEntity>,
    dataSource,
    outbox as unknown as OutboxService,
    mapper,
    runMapper,
  );
  return { repository, automations, statements, locks, outbox };
}

describe('AutomationRepository.fireDueSchedules', () => {
  it('runs the whole tick on its transaction, and counts the runs it queues', async () => {
    const { repository, automations, statements, locks, outbox } = harness();
    const contexts: FiringContext[] = [];
    const queued = await repository.fireDueSchedules(
      now,
      200,
      since,
      ({ automation, trigger }, scheduledFor, context) => {
        contexts.push(structuredClone(context));
        const run = AutomationRunEntity.fire(
          {
            organizationId: automation.organizationId,
            automationId: automation.id,
            revisionId: automation.revision.id,
            triggerId: trigger.id,
            cause: 'schedule',
            causeKey: `schedule:${trigger.id}:${scheduledFor.toISOString()}`,
            causeSummary: { label: 'Schedule', text: 'Every hour', eventType: 'schedule' },
            inboundEventId: null,
            scheduledFor,
            requestedByUserId: null,
          },
          now,
        );
        return { run, nextFireAt: null };
      },
      'tick-1',
    );

    expect(locks).toEqual(['for_no_key_update', 'skip_locked']);
    expect(queued).toHaveLength(2);
    expect(statements.some((sql) => sql.includes('pg_advisory_xact_lock'))).toBe(true);
    expect(statements).toContain('findBy AutomationSettingsOrmEntity');
    // The saved settings, shaped once; the counts as read, then with the first run in them.
    expect(contexts[0]).toEqual({
      workspace: expect.objectContaining({ maxRunsPerWorkspaceHour: 3, overlap: 'queue' }),
      recent: { automation: 2, workspace: 2 },
    });
    expect(contexts[1].recent).toEqual({ automation: 0, workspace: 3 });
    expect(queued.map((run) => run.automationId)).toEqual(automations.map((a) => a.id));
    expect(outbox.transaction).toHaveBeenCalledTimes(1);
    expect(outbox.stageJob).toHaveBeenCalledTimes(2);
    // Each dispatch carries the tick's correlation id, passed in, not read ambiently.
    for (const [, job] of outbox.stageJob.mock.calls) expect(job.correlationId).toBe('tick-1');
  });

  it('takes the firing locks before it counts', async () => {
    const { repository, statements } = harness();
    await repository.fireDueSchedules(
      now,
      200,
      since,
      () => ({ run: null, nextFireAt: null }),
      'corr-1',
    );
    const lock = statements.findIndex((sql) => sql.includes('pg_advisory_xact_lock'));
    const count = statements.findIndex((sql) => sql.includes('GROUPING SETS'));
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(lock).toBeLessThan(count);
  });
});
