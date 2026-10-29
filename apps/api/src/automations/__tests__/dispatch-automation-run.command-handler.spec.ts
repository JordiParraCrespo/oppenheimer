import type { ConfigService } from '@nestjs/config';
import { AppError } from '@oppenheimer/backend-core';
import { Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import { HostErrors } from '../../hosts/domain/hosts.errors';
import type { InboundEventLookupPort } from '../../inbound-events/application/inbound-event-lookup.port';
import { AutomationLimitsResolver } from '../application/automation-limits.resolver';
import type {
  AutomationRunTargetPort,
  RunTargetDecision,
} from '../application/automation-run-target.port';
import { AutomationRunTargetRegistry } from '../application/automation-run-target.registry';
import type { OwnerScopeResolver } from '../application/owner-scope.resolver';
import { RunDispatchResolver } from '../application/run-dispatch.resolver';
import { AutomationRunMapper } from '../automation-run.mapper';
import { DispatchAutomationRunCommand } from '../commands/dispatch-automation-run/dispatch-automation-run.command';
import { DispatchAutomationRunCommandHandler } from '../commands/dispatch-automation-run/dispatch-automation-run.command-handler';
import type { AutomationRepositoryPort } from '../database/automation.repository.port';
import type { AutomationRunRepositoryPort } from '../database/automation-run.repository.port';
import type { AutomationSettingsRepositoryPort } from '../database/automation-settings.repository.port';
import { AutomationEntity } from '../domain/automation.entity';
import { AutomationRunEntity } from '../domain/automation-run.entity';
import { runRefusalOf } from '../domain/run-refusal.policy';
import { triggerFromInput } from '../domain/trigger-config.policy';

/**
 * The dispatcher's seam with what a run starts (`26-bot-routines.md` §3): the
 * shared guards decide first, the automation's target decides and launches
 * second, and what the target says — a launch, a refusal, a fault — is what
 * the run records. The session target's own guards and launch are the
 * integration suite's; here the target is a stand-in, so the dispatcher is
 * proven against the port rather than against sessions.
 */
function automation(active = true) {
  return AutomationEntity.createNew({
    organizationId: 'org-1',
    projectId: 'project-1',
    ownerUserId: 'user-1',
    name: 'Nightly audit',
    revision: {
      place: 'host',
      hostId: 'host-1',
      agent: 'claude-code',
      model: null,
      permission: 'auto',
      effort: null,
      prompt: 'Audit the manifests.',
      repositories: [{ installationId: 'inst-1', githubRepoId: '101', fullName: 'acme/atlas' }],
      createdByUserId: 'user-1',
    },
    triggers: [
      triggerFromInput(
        { source: 'schedule', frequency: 'daily', hour: 9, minute: 0, timezone: 'Europe/Madrid' },
        0,
      ),
    ],
    active,
    now: new Date(),
  });
}

function pendingRun(automationId: string, cause: 'manual' | 'schedule' = 'schedule') {
  return AutomationRunEntity.fire(
    {
      organizationId: 'org-1',
      automationId,
      revisionId: 'r-1',
      triggerId: null,
      cause,
      causeKey: `${cause}:1`,
      causeSummary: { label: 'Nightly', text: '', eventType: cause },
      inboundEventId: null,
      scheduledFor: null,
      requestedByUserId: 'user-1',
    },
    new Date(),
  );
}

function stubTarget(
  overrides: Partial<AutomationRunTargetPort<string>> = {},
): AutomationRunTargetPort<string> {
  return {
    kind: 'session',
    decide: vi.fn(
      async (): Promise<RunTargetDecision<string>> => ({ kind: 'launch', input: 'the input' }),
    ),
    launch: vi.fn(async () => ({ kind: 'session' as const, sessionId: 'session-1' })),
    refusalOf: (error: unknown) => runRefusalOf(error instanceof AppError ? error.code : undefined),
    ...overrides,
  };
}

function setup(entity: AutomationEntity, run: AutomationRunEntity, target = stubTarget()) {
  const save = vi.fn(async () => undefined);
  const runs = {
    findOneForSystem: vi.fn(async () => Some(run)),
    save,
  } as unknown as AutomationRunRepositoryPort;
  const saveForSystem = vi.fn(async () => undefined);
  const automations = {
    findOneByIdForSystem: vi.fn(async () => Some(entity)),
    saveForSystem,
  } as unknown as AutomationRepositoryPort;
  const settings: AutomationSettingsRepositoryPort = {
    find: vi.fn(async () => ({})),
    upsert: vi.fn(),
  };
  const config = { get: () => undefined } as unknown as ConfigService;
  const owners = {
    resolve: vi.fn(async () => ({ userId: 'user-1' })),
  } as unknown as OwnerScopeResolver;
  const registry = new AutomationRunTargetRegistry();
  registry.registerAll([target]);
  const handler = new DispatchAutomationRunCommandHandler(
    runs,
    automations,
    new RunDispatchResolver(
      new AutomationLimitsResolver(settings, config),
      owners,
      registry,
      // These runs fire on a schedule, so no event is ever looked up.
      { findOne: vi.fn() } as unknown as InboundEventLookupPort,
      new AutomationRunMapper(),
    ),
  );
  const dispatch = () => handler.execute(new DispatchAutomationRunCommand({ runId: run.id }));
  return { dispatch, target, save, saveForSystem };
}

describe('dispatching a run through its target', () => {
  it('records the session the target launched, with what the target decided to launch', async () => {
    const entity = automation();
    const run = pendingRun(entity.id);
    const { dispatch, target } = setup(entity, run);

    await expect(dispatch()).resolves.toBe('dispatched');

    expect(target.launch).toHaveBeenCalledWith(
      expect.objectContaining({ run, automation: entity, scope: { userId: 'user-1' } }),
      'the input',
    );
    expect(run).toMatchObject({ outcome: 'dispatched', sessionId: 'session-1' });
  });

  it('never asks the target about a run the shared guards turned away', async () => {
    const entity = automation(false);
    const run = pendingRun(entity.id);
    const { dispatch, target } = setup(entity, run);

    await expect(dispatch()).resolves.toBe('paused');

    expect(target.decide).not.toHaveBeenCalled();
    expect(run).toMatchObject({ outcome: 'skipped', skipReason: 'paused' });
  });

  it('keeps a deferral the target asks for, and launches nothing', async () => {
    const entity = automation();
    const run = pendingRun(entity.id);
    const until = new Date(Date.now() + 60_000);
    const { dispatch, target } = setup(
      entity,
      run,
      stubTarget({ decide: vi.fn(async () => ({ kind: 'defer' as const, until })) }),
    );

    await expect(dispatch()).resolves.toBe('deferred');

    expect(target.launch).not.toHaveBeenCalled();
    expect(run).toMatchObject({ outcome: 'pending', availableAt: until });
  });

  it('skips a run the target refused at launch, and pauses the automation when it would keep failing', async () => {
    const entity = automation();
    const run = pendingRun(entity.id);
    const refused = new AppError(HostErrors.NOT_FOUND);
    const { dispatch, saveForSystem } = setup(
      entity,
      run,
      stubTarget({ launch: vi.fn(async () => Promise.reject(refused)) }),
    );

    await expect(dispatch()).resolves.toBe('not_launchable');

    expect(run).toMatchObject({ outcome: 'skipped', skipReason: 'not_launchable' });
    expect(entity.isPaused).toBe(true);
    expect(saveForSystem).toHaveBeenCalledWith(entity);
  });

  it('leaves the run pending on a fault the target does not recognise, so the queue retries it', async () => {
    const entity = automation();
    const run = pendingRun(entity.id);
    const { dispatch, save } = setup(
      entity,
      run,
      stubTarget({ launch: vi.fn(async () => Promise.reject(new Error('relay down'))) }),
    );

    await expect(dispatch()).rejects.toThrow('relay down');

    expect(run.isPending).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });
});

describe('the run-target registry', () => {
  it('refuses a second adapter for a kind, so two modules cannot both claim one at boot', () => {
    const registry = new AutomationRunTargetRegistry();
    registry.registerAll([stubTarget()]);
    expect(() => registry.registerAll([stubTarget()])).toThrow(
      'Two adapters were contributed for the run target session',
    );
  });

  it('fails loudly for a kind nobody contributed, instead of skipping the run as refused', () => {
    expect(() => new AutomationRunTargetRegistry().get('session')).toThrow(
      'No adapter was contributed for the run target session',
    );
  });
});
