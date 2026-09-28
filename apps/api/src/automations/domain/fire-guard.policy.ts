import type { AutomationSkipReason } from '@oppenheimer/shared/automations';
import type { AutomationLimits } from './automation-limits.policy';

/**
 * The guards (§Guards): small pure rules, each answering allow, skip with a
 * reason, or defer. Two moments ask them — cheap ones when a trigger fires,
 * the ones that read the world at dispatch — and a new guard is a function here
 * plus one line where its moment runs the chain.
 */
export type GuardVerdict =
  | { kind: 'allow' }
  | { kind: 'skip'; reason: AutomationSkipReason }
  | { kind: 'defer'; delayMs: number }
  /** A pending run past its TTL: it will not start now, and never silently late. */
  | { kind: 'expire' };

export const ALLOW: GuardVerdict = { kind: 'allow' };

/** Run the chain in order; the first verdict that is not `allow` decides. */
export function firstRefusal(...verdicts: (() => GuardVerdict)[]): GuardVerdict {
  for (const verdict of verdicts) {
    const outcome = verdict();
    if (outcome.kind !== 'allow') return outcome;
  }
  return ALLOW;
}

// -- At firing ---------------------------------------------------------------

/** Paused ignores triggers. Run now is a person asking, and passes. */
export function pausedGuard(paused: boolean, manual: boolean): GuardVerdict {
  return paused && !manual ? { kind: 'skip', reason: 'paused' } : ALLOW;
}

/** An event our own App caused — a run's push, its comment — never starts another run. */
export function loopGuard(actorIsOwnApp: boolean): GuardVerdict {
  return actorIsOwnApp ? { kind: 'skip', reason: 'own_event' } : ALLOW;
}

/** The hourly caps, per automation and per workspace, counted from stored runs. */
export function rateGuard(
  limits: Pick<AutomationLimits, 'maxRunsPerAutomationHour' | 'maxRunsPerWorkspaceHour'>,
  recent: { automation: number; workspace: number },
  manual: boolean,
): GuardVerdict {
  // Run now is one person pressing a button; the caps are for machines.
  if (manual) return ALLOW;
  if (recent.automation >= limits.maxRunsPerAutomationHour) {
    return { kind: 'skip', reason: 'automation_rate_limited' };
  }
  if (recent.workspace >= limits.maxRunsPerWorkspaceHour) {
    return { kind: 'skip', reason: 'workspace_rate_limited' };
  }
  return ALLOW;
}

/**
 * A schedule slot the scheduler reached late — the API was down — fires once
 * within the grace and is recorded as missed past it, never as a burst.
 */
export function missedSlotGuard(
  scheduledFor: Date,
  now: Date,
  limits: Pick<AutomationLimits, 'missedGraceSeconds'>,
): GuardVerdict {
  return now.getTime() - scheduledFor.getTime() > limits.missedGraceSeconds * 1000
    ? { kind: 'skip', reason: 'missed' }
    : ALLOW;
}

// -- At dispatch -------------------------------------------------------------

/** How long a deferred run waits before the dispatcher looks again. */
export const DEFER_DELAY_MS = 60_000;

/** A run that waited past its TTL — a host offline all night — expires rather than starting hours late. */
export function staleGuard(
  createdAt: Date,
  now: Date,
  limits: Pick<AutomationLimits, 'staleTtlSeconds'>,
): GuardVerdict {
  return now.getTime() - createdAt.getTime() > limits.staleTtlSeconds * 1000
    ? { kind: 'expire' }
    : ALLOW;
}

/** Another run of the same automation is still live. */
export function overlapGuard(
  otherLiveRuns: number,
  limits: Pick<AutomationLimits, 'overlap'>,
): GuardVerdict {
  if (otherLiveRuns === 0) return ALLOW;
  return limits.overlap === 'queue'
    ? { kind: 'defer', delayMs: DEFER_DELAY_MS }
    : { kind: 'skip', reason: 'overlapping' };
}

/** The host already runs as many automation runs as it takes at once. */
export function capacityGuard(
  liveOnHost: number,
  limits: Pick<AutomationLimits, 'liveRunsPerHost'>,
): GuardVerdict {
  return liveOnHost >= limits.liveRunsPerHost ? { kind: 'defer', delayMs: DEFER_DELAY_MS } : ALLOW;
}

/**
 * A host that last reported less free disk than the floor waits: a worktree
 * and an agent's build need room, and a run accepted onto a full disk fails
 * after the fact. A host that never reported is not held back on a guess.
 */
export function diskGuard(
  freeBytes: number | null,
  limits: Pick<AutomationLimits, 'diskFloorBytes'>,
): GuardVerdict {
  return freeBytes !== null && freeBytes < limits.diskFloorBytes
    ? { kind: 'defer', delayMs: DEFER_DELAY_MS }
    : ALLOW;
}
