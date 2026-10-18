import { emptyScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { RunTargetContext } from '../../../automations/application/automation-run-target.port';
import { AutomationEntity } from '../../../automations/domain/automation.entity';
import {
  DEFAULT_PLATFORM_LIMITS,
  resolveAutomationLimits,
} from '../../../automations/domain/automation-limits.policy';
import { AutomationRunEntity } from '../../../automations/domain/automation-run.entity';
import { triggerFromInput } from '../../../automations/domain/trigger-config.policy';
import { BotErrors } from '../../../bots/domain/bots.errors';
import type { BotModelAccessResolver } from '../../application/bot-model-access.resolver';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { BotRoutineTarget } from '../bot-routine-target.adapter';
import type { BotStreamPort } from '../bot-stream.port';

/**
 * A bot routine's run (`26-bot-routines.md` §4): one queued turn of its bot,
 * on the bot's model as it is now, as the owner, within the routine's scopes.
 * What breaks this: a run with no usable provider queuing a turn that fails,
 * a busy routine queuing a second turn, a retried dispatch queuing twice, or
 * a refusal read as a fault the queue retries forever.
 */
const now = new Date();

function routine() {
  return AutomationEntity.createRoutine({
    organizationId: 'org-1',
    ownerUserId: 'owner-1',
    botId: 'bot-1',
    name: 'Morning PR digest',
    prompt: 'List the open pull requests.',
    triggers: [
      triggerFromInput(
        { source: 'schedule', frequency: 'daily', hour: 9, minute: 0, timezone: 'Europe/Madrid' },
        0,
      ),
    ],
    active: true,
    credentialScopes: ['automations:read'],
    now,
  });
}

function setup(
  options: { model?: boolean; busy?: boolean; outcome?: 'staged' | 'existing' | 'missing' } = {},
) {
  const automation = routine();
  const run = AutomationRunEntity.fire(
    {
      organizationId: 'org-1',
      automationId: automation.id,
      revisionId: automation.revision.id,
      triggerId: automation.triggers[0].id,
      cause: 'schedule',
      causeKey: 'schedule:1',
      causeSummary: { label: 'Daily', text: '', eventType: 'schedule' },
      inboundEventId: null,
      scheduledFor: now,
      requestedByUserId: null,
    },
    now,
  );
  const access = {
    ownModel: vi.fn(async () =>
      options.model === false ? null : { provider: 'glm', model: 'glm-5.3', apiKey: 'k' },
    ),
    bot: vi.fn(async () => ({ provider: 'glm', model: 'glm-5.3', effort: null })),
  } as unknown as BotModelAccessResolver;
  const enqueueOnce = vi.fn(async (turn: { id: string }) => ({
    outcome: options.outcome ?? 'staged',
    turnId: options.outcome === 'existing' ? 'turn-first' : turn.id,
  }));
  const turns = {
    enqueueOnce,
    hasActiveFrom: vi.fn(async () => options.busy ?? false),
  } as unknown as BotTurnRepositoryPort;
  const publish = vi.fn(async () => undefined);
  const target = new BotRoutineTarget(access, turns, { publish } as unknown as BotStreamPort);
  const context: RunTargetContext = {
    run,
    automation,
    scope: emptyScope('owner-1', 'org-1'),
    limits: resolveAutomationLimits(DEFAULT_PLATFORM_LIMITS, {}, automation),
    event: null,
    now,
  };
  return { target, context, enqueueOnce, publish, run };
}

describe('BotRoutineTarget', () => {
  it('queues a turn of the routine, as its owner, in its schedule’s zone, within its scopes', async () => {
    const { target, context, enqueueOnce, publish, run } = setup();
    const decision = await target.decide(context);
    if (decision.kind !== 'launch') throw new Error(`expected a launch, got ${decision.kind}`);
    const ref = await target.launch(context, decision.input);

    const [turn, opening] = enqueueOnce.mock.calls[0] as unknown as [
      Record<string, unknown>,
      { content: string; event: unknown },
    ];
    expect(turn).toMatchObject({
      origin: 'routine',
      requestedByUserId: 'owner-1',
      timeZone: 'Europe/Madrid',
      credentialScopes: ['automations:read'],
    });
    expect(opening.event).toEqual({
      kind: 'routine',
      activity: 'ran',
      automationId: context.automation.id,
      runId: run.id,
      name: 'Morning PR digest',
      reason: null,
    });
    expect(opening.content).toContain('List the open pull requests.');
    expect(ref).toEqual({ kind: 'bot_turn', turnId: (turn as { id: string }).id });
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('skips a run whose bot has no usable provider, and queues nothing', async () => {
    const { target, context, enqueueOnce } = setup({ model: false });
    await expect(target.decide(context)).resolves.toEqual({
      kind: 'skip',
      reason: 'not_launchable',
      pause: null,
    });
    expect(enqueueOnce).not.toHaveBeenCalled();
  });

  it('skips a run while the routine’s last turn still waits or runs', async () => {
    const { target, context } = setup({ busy: true });
    await expect(target.decide(context)).resolves.toMatchObject({
      kind: 'skip',
      reason: 'overlapping',
    });
  });

  it('answers the turn a retried dispatch already queued, and announces nothing twice', async () => {
    const { target, context, publish } = setup({ outcome: 'existing' });
    const decision = await target.decide(context);
    if (decision.kind !== 'launch') throw new Error('expected a launch');
    await expect(target.launch(context, decision.input)).resolves.toEqual({
      kind: 'bot_turn',
      turnId: 'turn-first',
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it('reads a bot gone at launch as a refusal the run skips, and anything else as a fault', async () => {
    const { target } = setup();
    expect(target.refusalOf(new AppError(BotErrors.NOT_FOUND))).toEqual({
      reason: 'not_launchable',
      pause: null,
    });
    expect(target.refusalOf(new Error('database down'))).toBeNull();
  });
});
