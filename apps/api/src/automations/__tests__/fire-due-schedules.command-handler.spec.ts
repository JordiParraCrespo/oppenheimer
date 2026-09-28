import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { AutomationLimitsResolver } from '../application/automation-limits.resolver';
import { FireDueSchedulesCommand } from '../commands/fire-due-schedules/fire-due-schedules.command';
import { FireDueSchedulesCommandHandler } from '../commands/fire-due-schedules/fire-due-schedules.command-handler';
import type {
  AutomationRepositoryPort,
  DueScheduleDecision,
  FiringContext,
  TriggerCandidate,
} from '../database/automation.repository.port';
import type { AutomationSettingsRepositoryPort } from '../database/automation-settings.repository.port';
import { AutomationEntity } from '../domain/automation.entity';
import type { WorkspaceLimits } from '../domain/automation-limits.policy';
import type { AutomationRunEntity } from '../domain/automation-run.entity';
import { triggerFromInput } from '../domain/trigger-config.policy';

const now = new Date('2026-09-27T10:00:00Z');

function scheduled(name: string): TriggerCandidate {
  const automation = AutomationEntity.createNew({
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
  return { automation, trigger: automation.triggers[0] };
}

/**
 * The repository's side of the contract, in memory: every candidate is weighed
 * against the counts it read at the claim, and each run it queues is counted
 * before the next candidate is asked — which is what the real one does inside
 * its transaction.
 */
function fakeRepository(
  candidates: TriggerCandidate[],
  workspace: WorkspaceLimits,
  recent: FiringContext['recent'],
) {
  const decisions: DueScheduleDecision[] = [];
  const contexts: FiringContext[] = [];
  const fireDueSchedules = vi.fn(
    async (
      _now: Date,
      _batch: number,
      _since: Date,
      decide: (c: TriggerCandidate, s: Date, x: FiringContext) => DueScheduleDecision,
    ): Promise<AutomationRunEntity[]> => {
      const counts = { ...recent };
      const queued: AutomationRunEntity[] = [];
      for (const candidate of candidates) {
        const context = { workspace, recent: { ...counts } };
        contexts.push(context);
        const decision = decide(candidate, now, context);
        decisions.push(decision);
        if (decision.run?.isPending) {
          counts.automation += 1;
          counts.workspace += 1;
          queued.push(decision.run);
        }
      }
      return queued;
    },
  );
  return {
    repository: { fireDueSchedules } as unknown as AutomationRepositoryPort,
    fireDueSchedules,
    decisions,
    contexts,
  };
}

function handler(repository: AutomationRepositoryPort) {
  const settings: AutomationSettingsRepositoryPort = {
    find: vi.fn(async () => {
      throw new Error('the tick reads its settings inside the claim, not through the store');
    }),
    upsert: vi.fn(),
  };
  const config = { get: () => undefined } as unknown as ConfigService;
  return new FireDueSchedulesCommandHandler(
    repository,
    new AutomationLimitsResolver(settings, config),
  );
}

describe('FireDueSchedulesCommandHandler', () => {
  it('decides synchronously, from the context the claim read, with the rate window an hour back', async () => {
    const fake = fakeRepository([scheduled('One')], {}, { automation: 0, workspace: 0 });
    const queued = await handler(fake.repository).execute(new FireDueSchedulesCommand({ now }));
    expect(queued).toBe(1);
    const [, batch, since] = fake.fireDueSchedules.mock.calls[0];
    expect(batch).toBe(200);
    expect(since.toISOString()).toBe('2026-09-27T09:00:00.000Z');
    expect(fake.decisions[0].run?.isPending).toBe(true);
    expect(fake.decisions[0].nextFireAt).not.toBeNull();
  });

  it('counts the batch: one slot left fires the first trigger and skips the next', async () => {
    const fake = fakeRepository(
      [scheduled('One'), scheduled('Two')],
      { maxRunsPerWorkspaceHour: 5 },
      { automation: 0, workspace: 4 },
    );
    const queued = await handler(fake.repository).execute(new FireDueSchedulesCommand({ now }));
    expect(queued).toBe(1);
    expect(fake.contexts.map((context) => context.recent.workspace)).toEqual([4, 5]);
    expect(fake.decisions[0].run?.outcome).toBe('pending');
    expect(fake.decisions[1].run?.outcome).toBe('skipped');
    expect(fake.decisions[1].run?.skipReason).toBe('workspace_rate_limited');
  });

  it("applies the workspace's saved per-automation cap from the context", async () => {
    const fake = fakeRepository(
      [scheduled('One')],
      { maxRunsPerAutomationHour: 2 },
      { automation: 2, workspace: 2 },
    );
    await handler(fake.repository).execute(new FireDueSchedulesCommand({ now }));
    expect(fake.decisions[0].run?.skipReason).toBe('automation_rate_limited');
  });
});
