import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { CreateSessionDto } from '@oppenheimer/shared';
import type { AutomationPausedReason, AutomationSkipReason } from '@oppenheimer/shared/automations';
import type { HostVitalsPort } from '../../hosts/application/host-vitals.port';
import { HOST_VITALS } from '../../hosts/hosts.di-tokens';
import type { InboundEventLookupPort } from '../../inbound-events/application/inbound-event-lookup.port';
import { INBOUND_EVENT_LOOKUP } from '../../inbound-events/inbound-events.di-tokens';
import { AutomationRunMapper } from '../automation-run.mapper';
import { AUTOMATION_RUN_REPOSITORY } from '../automations.di-tokens';
import type { AutomationRunRepositoryPort } from '../database/automation-run.repository.port';
import type { AutomationEntity } from '../domain/automation.entity';
import type { AutomationRunEntity } from '../domain/automation-run.entity';
import {
  capacityGuard,
  diskGuard,
  firstRefusal,
  overlapGuard,
  pausedGuard,
  staleGuard,
} from '../domain/fire-guard.policy';
import { composeRunPrompt, type RunEventView, runCheckout } from '../domain/run-launch.policy';
import { runRefusalOf } from '../domain/run-refusal.policy';
import { AutomationLimitsResolver } from './automation-limits.resolver';
import { OwnerScopeResolver } from './owner-scope.resolver';

export type DispatchDecision =
  | { kind: 'skip'; reason: AutomationSkipReason; pause: AutomationPausedReason | null }
  | { kind: 'defer'; until: Date }
  | { kind: 'expire' }
  | { kind: 'launch'; scope: AccessScope; input: CreateSessionDto };

/**
 * What the dispatcher does with a pending run (§Guards, at dispatch), in two
 * steps: the guards that read the world — paused, stale, the owner, overlap,
 * the host's capacity and disk — and only once they all allow it, the session
 * to start and as whom. A run a guard turns away never reads its event or
 * composes a prompt.
 */
/**
 * How long a run waits after losing the race for a slot. Short, because what it
 * lost to is another run starting right now rather than a busy host: the next
 * attempt reads a settled count.
 */
const CLAIM_LOST_DELAY_MS = 5_000;

/**
 * How long a reservation counts for. Long enough that a slow launch is not
 * double-booked, short enough that a process dying between the claim and the
 * session frees the slot without anything having to clean up.
 */
const CLAIM_TTL_MS = 2 * 60_000;

@Injectable()
export class RunDispatchResolver {
  constructor(
    @Inject(AUTOMATION_RUN_REPOSITORY)
    private readonly runs: AutomationRunRepositoryPort,
    @Inject(INBOUND_EVENT_LOOKUP)
    private readonly events: InboundEventLookupPort,
    @Inject(HOST_VITALS)
    private readonly vitals: HostVitalsPort,
    private readonly limits: AutomationLimitsResolver,
    private readonly owners: OwnerScopeResolver,
    private readonly mapper: AutomationRunMapper,
  ) {}

  async decide(
    run: AutomationRunEntity,
    automation: AutomationEntity,
    now: Date,
  ): Promise<DispatchDecision> {
    if (automation.isDeleted) return { kind: 'skip', reason: 'deleted', pause: null };
    const limits = await this.limits.resolve(automation.organizationId, automation);
    const revision = automation.revision;

    const early = firstRefusal(
      () => pausedGuard(automation.isPaused, run.cause === 'manual'),
      () => staleGuard(run.createdAt, now, limits),
    );
    if (early.kind === 'expire') return { kind: 'expire' };
    if (early.kind === 'skip') return { kind: 'skip', reason: early.reason, pause: null };

    const scope = await this.owners.resolve(automation.organizationId, automation.ownerUserId);
    if (!scope) return { kind: 'skip', reason: 'not_launchable', pause: 'owner_lost_access' };

    // A run live past the run limit is being stopped; it holds no place.
    const liveSince = new Date(now.getTime() - limits.maxRunSeconds * 1000);
    const [otherLive, liveOnHost, freeDisk] = await Promise.all([
      this.runs.countLiveForAutomation(automation.id, run.id, liveSince),
      this.runs.countLiveOnHost(revision.hostId, run.id, liveSince),
      this.vitals.lastFreeDisk(revision.hostId),
    ]);
    const verdict = firstRefusal(
      () => overlapGuard(otherLive, limits),
      () => capacityGuard(liveOnHost, limits),
      () => diskGuard(freeDisk, limits),
    );
    if (verdict.kind === 'skip') return { kind: 'skip', reason: verdict.reason, pause: null };
    if (verdict.kind === 'defer') {
      return { kind: 'defer', until: new Date(now.getTime() + verdict.delayMs) };
    }

    // The counts above are a moment old, and the queue dispatches four runs at
    // once: every one of them read the same counts and every one passed, so a
    // cap of one live run per automation launched four. The slot is taken here
    // instead, under the host's lock and against counts read inside it, and the
    // run counts as live from that moment — so the workers that lose the race
    // see it and wait their turn.
    const claimed = await this.runs.claimSlot({
      runId: run.id,
      automationId: automation.id,
      hostId: revision.hostId,
      liveRunsPerHost: limits.liveRunsPerHost,
      overlap: limits.overlap,
      liveSince,
      // A claim is only honoured while it is fresher than the run limit, so a
      // process that died between claiming and launching frees its slot.
      claimFloor: new Date(now.getTime() - CLAIM_TTL_MS),
      now,
    });
    if (!claimed) {
      return { kind: 'defer', until: new Date(now.getTime() + CLAIM_LOST_DELAY_MS) };
    }

    return this.launchOf(run, automation, scope);
  }

  /** The session a run that passed every guard starts, or why it cannot. */
  private async launchOf(
    run: AutomationRunEntity,
    automation: AutomationEntity,
    scope: AccessScope,
  ): Promise<DispatchDecision> {
    const event = await this.eventOf(run);
    // A run started by an event that is gone (retention, a replay that never
    // landed) does not know why it exists, nor where it should start.
    if (run.cause === 'event' && !event) {
      return { kind: 'skip', reason: 'not_launchable', pause: null };
    }
    const prompt = composeRunPrompt(automation.revision.prompt, event);
    if (prompt === null) return { kind: 'skip', reason: 'not_launchable', pause: null };
    try {
      return {
        kind: 'launch',
        scope,
        input: this.mapper.toSessionInput(
          automation,
          runCheckout(automation.revision.repositories, event),
          prompt,
        ),
      };
    } catch (error) {
      const refusal = runRefusalOf(error instanceof AppError ? error.code : undefined);
      if (!refusal) throw error;
      return { kind: 'skip', reason: refusal.reason, pause: refusal.pause };
    }
  }

  private async eventOf(run: AutomationRunEntity): Promise<RunEventView | null> {
    if (!run.inboundEventId) return null;
    const found = await this.events.findOne(run.organizationId, run.inboundEventId);
    return found.isSome() ? this.mapper.eventViewOf(found.unwrap()) : null;
  }
}
