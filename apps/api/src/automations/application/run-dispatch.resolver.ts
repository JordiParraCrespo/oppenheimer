import { Inject, Injectable } from '@nestjs/common';
import type { AutomationPausedReason, AutomationSkipReason } from '@oppenheimer/shared/automations';
import type { InboundEventLookupPort } from '../../inbound-events/application/inbound-event-lookup.port';
import { INBOUND_EVENT_LOOKUP } from '../../inbound-events/inbound-events.di-tokens';
import { AutomationRunMapper } from '../automation-run.mapper';
import type { AutomationEntity } from '../domain/automation.entity';
import type { AutomationRunTargetKind, RunDispatchRef } from '../domain/automation.types';
import type { AutomationRunEntity } from '../domain/automation-run.entity';
import { firstRefusal, pausedGuard, staleGuard } from '../domain/fire-guard.policy';
import type { RunEventView } from '../domain/run-launch.policy';
import type { RunRefusal } from '../domain/run-refusal.policy';
import { AutomationLimitsResolver } from './automation-limits.resolver';
import type { AutomationRunTargetPort, RunTargetContext } from './automation-run-target.port';
import { AutomationRunTargetRegistry } from './automation-run-target.registry';
import { OwnerScopeResolver } from './owner-scope.resolver';

export type DispatchDecision =
  | { kind: 'skip'; reason: AutomationSkipReason; pause: AutomationPausedReason | null }
  | { kind: 'defer'; until: Date }
  | { kind: 'expire' }
  | {
      kind: 'launch';
      target: AutomationRunTargetKind;
      /** The target's launch, bound to what it decided to launch. */
      launch: () => Promise<RunDispatchRef>;
      /** What an error thrown by `launch` means for the run, in the target's terms. */
      refusalOf: (error: unknown) => RunRefusal | null;
    };

/**
 * What the dispatcher does with a pending run (§Guards, at dispatch), in two
 * steps: the guards every run shares — deleted, paused, stale, an owner who
 * can still act in the workspace — and then the run's target
 * (`26-bot-routines.md` §3), which runs the guards only it needs and says what
 * it would launch. A run a guard turns away never reaches its target.
 */
@Injectable()
export class RunDispatchResolver {
  constructor(
    private readonly limits: AutomationLimitsResolver,
    private readonly owners: OwnerScopeResolver,
    private readonly targets: AutomationRunTargetRegistry,
    @Inject(INBOUND_EVENT_LOOKUP)
    private readonly events: InboundEventLookupPort,
    private readonly mapper: AutomationRunMapper,
  ) {}

  async decide(
    run: AutomationRunEntity,
    automation: AutomationEntity,
    now: Date,
  ): Promise<DispatchDecision> {
    if (automation.isDeleted) return { kind: 'skip', reason: 'deleted', pause: null };
    const limits = await this.limits.resolve(automation.organizationId, automation);

    const early = firstRefusal(
      () => pausedGuard(automation.isPaused, run.cause === 'manual'),
      () => staleGuard(run.createdAt, now, limits),
    );
    if (early.kind === 'expire') return { kind: 'expire' };
    if (early.kind === 'skip') return { kind: 'skip', reason: early.reason, pause: null };

    const scope = await this.owners.resolve(automation.organizationId, automation.ownerUserId);
    if (!scope) return { kind: 'skip', reason: 'not_launchable', pause: 'owner_lost_access' };

    const event = await this.eventOf(run);
    // A run started by an event that is gone (retention, a replay that never
    // landed) does not know why it exists, nor where it should start.
    if (run.cause === 'event' && !event) {
      return { kind: 'skip', reason: 'not_launchable', pause: null };
    }

    const context: RunTargetContext = { run, automation, scope, limits, event, now };
    return decideWith(this.targets.get(automation.runTarget), context);
  }

  private async eventOf(run: AutomationRunEntity): Promise<RunEventView | null> {
    if (!run.inboundEventId) return null;
    const found = await this.events.findOne(run.organizationId, run.inboundEventId);
    return found.isSome() ? this.mapper.eventViewOf(found.unwrap()) : null;
  }
}

/**
 * The target's decision, with a launch bound to its own input: the input's
 * type is known only inside the target, so it never travels as `unknown`.
 */
async function decideWith<TInput>(
  target: AutomationRunTargetPort<TInput>,
  context: RunTargetContext,
): Promise<DispatchDecision> {
  const decision = await target.decide(context);
  if (decision.kind !== 'launch') return decision;
  return {
    kind: 'launch',
    target: target.kind,
    launch: () => target.launch(context, decision.input),
    refusalOf: (error) => target.refusalOf(error),
  };
}
