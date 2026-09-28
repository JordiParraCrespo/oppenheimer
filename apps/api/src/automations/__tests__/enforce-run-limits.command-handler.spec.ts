import type { ConfigService } from '@nestjs/config';
import type { CommandBus } from '@nestjs/cqrs';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import { AutomationLimitsResolver } from '../application/automation-limits.resolver';
import type { OwnerScopeResolver } from '../application/owner-scope.resolver';
import { EnforceRunLimitsCommand } from '../commands/enforce-run-limits/enforce-run-limits.command';
import { EnforceRunLimitsCommandHandler } from '../commands/enforce-run-limits/enforce-run-limits.command-handler';
import type { AutomationRepositoryPort } from '../database/automation.repository.port';
import type {
  AutomationRunRepositoryPort,
  LiveRun,
} from '../database/automation-run.repository.port';
import type { AutomationSettingsRepositoryPort } from '../database/automation-settings.repository.port';

const now = new Date('2026-09-27T10:00:00Z');
const HOUR = 60 * 60 * 1000;

function live(runId: string, automationId: string, hoursAgo: number): LiveRun {
  return {
    runId,
    organizationId: 'org-1',
    automationId,
    sessionId: `session-${runId}`,
    dispatchedAt: new Date(now.getTime() - hoursAgo * HOUR),
  };
}

function setup(candidates: LiveRun[]) {
  const findLiveDispatchedBefore = vi.fn(async () => candidates);
  const runs = { findLiveDispatchedBefore } as unknown as AutomationRunRepositoryPort;
  const findOneByIdForSystem = vi.fn(async (id: string) =>
    id === 'gone' ? None : Some({ id, ownerUserId: 'user-1' }),
  );
  const automations = { findOneByIdForSystem } as unknown as AutomationRepositoryPort;
  const settings: AutomationSettingsRepositoryPort = {
    find: vi.fn(async () => ({ maxRunSeconds: 60 * 60 })),
    upsert: vi.fn(),
  };
  const config = { get: () => undefined } as unknown as ConfigService;
  const resolve = vi.fn(async () => ({ userId: 'user-1' }));
  const owners = { resolve } as unknown as OwnerScopeResolver;
  const execute = vi.fn(async () => undefined);
  const commandBus = { execute } as unknown as CommandBus;
  const handler = new EnforceRunLimitsCommandHandler(
    runs,
    automations,
    new AutomationLimitsResolver(settings, config),
    owners,
    commandBus,
  );
  return { handler, findLiveDispatchedBefore, findOneByIdForSystem, resolve, execute };
}

describe('EnforceRunLimitsCommandHandler', () => {
  it('weighs only runs dispatched since the platform ceiling plus an hour', async () => {
    const { handler, findLiveDispatchedBefore } = setup([]);
    await handler.execute(new EnforceRunLimitsCommand({ now }));
    const [before, notBefore, batch] = findLiveDispatchedBefore.mock.calls[0] as unknown as [
      Date,
      Date,
      number,
    ];
    expect(before.toISOString()).toBe('2026-09-27T09:59:00.000Z');
    // The platform's ceiling is six hours; the grace one more.
    expect(notBefore.toISOString()).toBe('2026-09-27T03:00:00.000Z');
    expect(batch).toBe(200);
  });

  it('loads each automation and owner scope once, however many of its runs are over', async () => {
    const { handler, findOneByIdForSystem, resolve, execute } = setup([
      live('run-1', 'automation-1', 2),
      live('run-2', 'automation-1', 3),
      live('run-3', 'gone', 2),
      live('run-4', 'gone', 4),
      live('run-5', 'automation-1', 0.5), // within its limit
    ]);
    expect(await handler.execute(new EnforceRunLimitsCommand({ now }))).toBe(2);
    expect(findOneByIdForSystem).toHaveBeenCalledTimes(2);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
