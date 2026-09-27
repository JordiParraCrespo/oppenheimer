import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import type { CreateSessionDto } from '@oppenheimer/shared';
import type { AutomationPausedReason, AutomationSkipReason } from '@oppenheimer/shared/automations';
import type { InboundEventLookupPort } from '../../inbound-events/application/inbound-event-lookup.port';
import { INBOUND_EVENT_LOOKUP } from '../../inbound-events/inbound-events.di-tokens';
import { AutomationRunMapper } from '../automation-run.mapper';
import { AUTOMATION_RUN_REPOSITORY } from '../automations.di-tokens';
import type { AutomationRunRepositoryPort } from '../database/automation-run.repository.port';
import type { AutomationEntity } from '../domain/automation.entity';
import type { AutomationRunEntity } from '../domain/automation-run.entity';
import {
  capacityGuard,
  firstRefusal,
  overlapGuard,
  pausedGuard,
  staleGuard,
} from '../domain/fire-guard.policy';
import { composeRunPrompt, type RunEventView, runCheckout } from '../domain/run-launch.policy';
import { AutomationLimitsResolver } from './automation-limits.resolver';
import { OwnerScopeResolver } from './owner-scope.resolver';

export type DispatchDecision =
  | { kind: 'skip'; reason: AutomationSkipReason; pause: AutomationPausedReason | null }
  | { kind: 'defer'; until: Date }
  | { kind: 'expire' }
  | { kind: 'launch'; scope: AccessScope; input: CreateSessionDto };

/**
 * What the dispatcher does with a pending run (§Guards, at dispatch): the
 * guards that read the world — paused, stale, the owner, overlap, the host's
 * capacity — and, when they all allow it, the session to start and as whom.
 */
@Injectable()
export class RunDispatchResolver {
  constructor(
    @Inject(AUTOMATION_RUN_REPOSITORY)
    private readonly runs: AutomationRunRepositoryPort,
    @Inject(INBOUND_EVENT_LOOKUP)
    private readonly events: InboundEventLookupPort,
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

    const [otherLive, liveOnHost] = await Promise.all([
      this.runs.countLiveForAutomation(automation.id, run.id),
      this.runs.countLiveOnHost(revision.hostId, run.id),
    ]);
    const verdict = firstRefusal(
      () => overlapGuard(otherLive, limits),
      () => capacityGuard(liveOnHost, limits),
    );
    if (verdict.kind === 'skip') return { kind: 'skip', reason: verdict.reason, pause: null };
    if (verdict.kind === 'defer') {
      return { kind: 'defer', until: new Date(now.getTime() + verdict.delayMs) };
    }

    const event = await this.eventOf(run);
    return {
      kind: 'launch',
      scope,
      input: this.mapper.toSessionInput(
        automation,
        runCheckout(revision.repositories, event),
        composeRunPrompt(revision.prompt, event),
      ),
    };
  }

  private async eventOf(run: AutomationRunEntity): Promise<RunEventView | null> {
    if (!run.inboundEventId) return null;
    const found = await this.events.findOne(run.organizationId, run.inboundEventId);
    return found.isSome() ? this.mapper.eventViewOf(found.unwrap()) : null;
  }
}
