import { Injectable } from '@nestjs/common';
import type { AutomationPausedReason, AutomationSkipReason } from '@oppenheimer/shared/automations';
import type { AutomationEntity } from '../domain/automation.entity';
import type { AutomationRunEntity } from '../domain/automation-run.entity';
import { firstRefusal, pausedGuard, staleGuard } from '../domain/fire-guard.policy';
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
      target: AutomationRunTargetPort;
      context: RunTargetContext;
      input: unknown;
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

    const target = this.targets.get(automation.runTarget);
    const context: RunTargetContext = { run, automation, scope, limits, now };
    const decision = await target.decide(context);
    return decision.kind === 'launch'
      ? { kind: 'launch', target, context, input: decision.input }
      : decision;
  }
}
