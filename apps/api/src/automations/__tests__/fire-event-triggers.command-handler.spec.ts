import type { ConfigService } from '@nestjs/config';
import { Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { InboundEventLookupPort } from '../../inbound-events/application/inbound-event-lookup.port';
import { AutomationLimitsResolver } from '../application/automation-limits.resolver';
import type { AutomationRunMapper } from '../automation-run.mapper';
import { FireEventTriggersCommand } from '../commands/fire-event-triggers/fire-event-triggers.command';
import { FireEventTriggersCommandHandler } from '../commands/fire-event-triggers/fire-event-triggers.command-handler';
import type { AutomationRepositoryPort } from '../database/automation.repository.port';
import type { AutomationRunRepositoryPort } from '../database/automation-run.repository.port';
import type { AutomationSettingsRepositoryPort } from '../database/automation-settings.repository.port';
import { AutomationEntity } from '../domain/automation.entity';
import type { AutomationRunEntity } from '../domain/automation-run.entity';
import { triggerFromInput } from '../domain/trigger-config.policy';

const now = new Date('2026-09-27T10:00:00Z');

function watching(name: string) {
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
      prompt: 'Review the pull request.',
      repositories: [{ installationId: 'inst-1', githubRepoId: '101', fullName: 'acme/atlas' }],
      createdByUserId: 'user-1',
    },
    triggers: [
      triggerFromInput(
        {
          source: 'github',
          event: 'pr_opened',
          repositories: [101],
          filter: { op: 'equals', value: 'main' },
        },
        0,
      ),
    ],
    active: true,
    now,
  });
  return { automation, trigger: automation.triggers[0] };
}

function command(actorIsOwnApp = false) {
  return new FireEventTriggersCommand({
    organizationId: 'org-1',
    inboundEventId: 'event-1',
    source: 'github',
    eventType: 'pr_opened',
    subjectRef: '101',
    externalId: 'delivery-1',
    actorIsOwnApp,
    attributes: { baseBranch: 'main' },
  });
}

function setup(recent: { automation: number; workspace: number }) {
  const candidates = [watching('One'), watching('Two'), watching('Three')];
  const automations = {
    findEventCandidates: vi.fn(async () => candidates),
  } as unknown as AutomationRepositoryPort;
  const decided: AutomationRunEntity[] = [];
  const fireUnderCaps = vi.fn(
    async (
      _organizationId: string,
      _automationId: string,
      _since: Date,
      decide: (counted: { automation: number; workspace: number }) => AutomationRunEntity,
    ) => {
      const run = decide(recent);
      decided.push(run);
      return { run, runId: run.id, inserted: true };
    },
  );
  const runs = { fireUnderCaps } as unknown as AutomationRunRepositoryPort;
  const events = {
    findOne: vi.fn(async () => Some({})),
  } as unknown as InboundEventLookupPort;
  const find = vi.fn(async () => ({ maxRunsPerWorkspaceHour: 7 }));
  const settings: AutomationSettingsRepositoryPort = { find, upsert: vi.fn() };
  const config = { get: () => undefined } as unknown as ConfigService;
  const mapper = {
    eventViewOf: () => ({
      type: 'pr_opened',
      source: 'github',
      subjectRef: '101',
      subjectName: 'acme/atlas',
      actorLogin: 'octocat',
      attributes: {},
      context: {},
    }),
  } as unknown as AutomationRunMapper;
  const handler = new FireEventTriggersCommandHandler(
    automations,
    runs,
    events,
    new AutomationLimitsResolver(settings, config),
    mapper,
  );
  return { handler, candidates, fireUnderCaps, find, decided };
}

describe('FireEventTriggersCommandHandler', () => {
  it("reads the workspace's settings once, however many automations match", async () => {
    vi.useFakeTimers({ now, toFake: ['Date'] });
    try {
      const { handler, candidates, fireUnderCaps, find } = setup({ automation: 0, workspace: 0 });
      expect(await handler.execute(command())).toBe(3);
      expect(find).toHaveBeenCalledTimes(1);
      expect(find).toHaveBeenCalledWith('org-1');
      expect(fireUnderCaps).toHaveBeenCalledTimes(3);
      for (const [index, call] of fireUnderCaps.mock.calls.entries()) {
        expect(call[0]).toBe('org-1');
        expect(call[1]).toBe(candidates[index].automation.id);
        expect(call[2].toISOString()).toBe('2026-09-27T09:00:00.000Z');
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('builds the run from the count read under the lock, against the saved cap', async () => {
    const { handler, decided } = setup({ automation: 0, workspace: 7 });
    expect(await handler.execute(command())).toBe(0);
    expect(decided.map((run) => run.skipReason)).toEqual([
      'workspace_rate_limited',
      'workspace_rate_limited',
      'workspace_rate_limited',
    ]);
  });

  it("records our own App's event as a skip before the caps are weighed", async () => {
    const { handler, decided } = setup({ automation: 0, workspace: 0 });
    expect(await handler.execute(command(true))).toBe(0);
    expect(decided.every((run) => run.skipReason === 'own_event')).toBe(true);
  });
});
