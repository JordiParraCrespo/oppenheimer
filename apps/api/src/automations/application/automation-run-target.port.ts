import type { AccessScope } from '@oppenheimer/backend-authz';
import type { AutomationPausedReason, AutomationSkipReason } from '@oppenheimer/shared/automations';
import type { AutomationEntity } from '../domain/automation.entity';
import type { AutomationRunTargetKind, RunDispatchRef } from '../domain/automation.types';
import type { AutomationLimits } from '../domain/automation-limits.policy';
import type { AutomationRunEntity } from '../domain/automation-run.entity';
import type { RunEventView } from '../domain/run-launch.policy';
import type { RunRefusal } from '../domain/run-refusal.policy';

/** What a target is handed once the shared guards (deleted, paused, stale, the owner) have passed. */
export interface RunTargetContext {
  run: AutomationRunEntity;
  automation: AutomationEntity;
  /** The owner's access in the workspace, resolved at dispatch (§Q5). */
  scope: AccessScope;
  limits: AutomationLimits;
  /** The event that fired it, for an event trigger; null for a schedule or Run now. */
  event: RunEventView | null;
  now: Date;
}

export type RunTargetDecision<TInput> =
  | { kind: 'skip'; reason: AutomationSkipReason; pause: AutomationPausedReason | null }
  | { kind: 'defer'; until: Date }
  | { kind: 'launch'; input: TInput };

/**
 * How a run of one kind of automation is carried out (`26-bot-routines.md`
 * §3). The dispatcher runs the guards every run shares and then hands the run
 * to the target its automation names: the target runs its own guards, says
 * what it will launch, and launches it as the owner. A target is contributed
 * by the module that owns what it starts (`AutomationsModule.contributeRunTargets`),
 * so the dispatcher names no other module.
 */
export interface AutomationRunTargetPort<TInput = unknown> {
  readonly kind: AutomationRunTargetKind;
  /** Its own guards, then what to launch; reads the world but changes nothing but a slot claim. */
  decide(context: RunTargetContext): Promise<RunTargetDecision<TInput>>;
  /** Carry the run out; idempotent on the run's id, since a queue job can run twice. */
  launch(context: RunTargetContext, input: TInput): Promise<RunDispatchRef>;
  /** What a refusal thrown by `launch` means for the run; null for a fault the queue retries. */
  refusalOf(error: unknown): RunRefusal | null;
}
