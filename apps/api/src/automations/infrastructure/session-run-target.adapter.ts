import { Inject, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { HostVitalsPort } from '../../hosts/application/host-vitals.port';
import { HOST_VITALS } from '../../hosts/hosts.di-tokens';
import { CreateSessionCommand } from '../../sessions/commands/create-session/create-session.command';
import { StartCloudSessionCommand } from '../../sessions/commands/start-cloud-session/start-cloud-session.command';
import type { SessionCommandResult } from '../../sessions/domain/session-command.types';
import type {
  AutomationRunTargetPort,
  RunTargetContext,
  RunTargetDecision,
} from '../application/automation-run-target.port';
import { sessionTargetOf } from '../application/session-target.policy';
import { AutomationRunMapper } from '../automation-run.mapper';
import { AUTOMATION_RUN_REPOSITORY } from '../automations.di-tokens';
import type { AutomationRunRepositoryPort } from '../database/automation-run.repository.port';
import type { RunDispatchRef, RunSessionLaunch } from '../domain/automation.types';
import { capacityGuard, diskGuard, firstRefusal, overlapGuard } from '../domain/fire-guard.policy';
import { composeRunPrompt, runCheckout } from '../domain/run-launch.policy';
import { type RunRefusal, runRefusalOf } from '../domain/run-refusal.policy';

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

/**
 * A run that starts a session where the automation runs (§Q4): on its host,
 * in Claude Code's cloud from that host, or at a vendor with no host
 * (`AUTOMATION_PLACES`). It is created **as the owner** through the same
 * command a person's session goes through (§Q5): the guards that only a
 * session needs — overlap, the host's capacity and disk, the slot claim —
 * and then the session itself. A session in the cloud holds no place on a
 * host, so only overlap holds it back. The session's idempotency key is the
 * run's id, so a job the queue runs twice — or a crash between the create
 * and the run's write — finds the session already made instead of making a
 * second.
 */
@Injectable()
export class SessionRunTarget implements AutomationRunTargetPort<RunSessionLaunch> {
  readonly kind = 'session' as const;

  constructor(
    @Inject(AUTOMATION_RUN_REPOSITORY)
    private readonly runs: AutomationRunRepositoryPort,
    @Inject(HOST_VITALS)
    private readonly vitals: HostVitalsPort,
    private readonly mapper: AutomationRunMapper,
    private readonly commandBus: CommandBus,
  ) {}

  async decide(context: RunTargetContext): Promise<RunTargetDecision<RunSessionLaunch>> {
    const { run, automation, limits, now } = context;
    const { revision } = sessionTargetOf(automation);
    // The host whose slots and disk the session takes; none in the cloud.
    const hostId = revision.place === 'host' ? revision.hostId : null;
    // A run live past the run limit is being stopped; it holds no place.
    const liveSince = new Date(now.getTime() - limits.maxRunSeconds * 1000);
    const [otherLive, liveOnHost, freeDisk] = await Promise.all([
      this.runs.countLiveForAutomation(automation.id, run.id, liveSince),
      hostId ? this.runs.countLiveOnHost(hostId, run.id, liveSince) : 0,
      hostId ? this.vitals.lastFreeDisk(hostId) : null,
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
      hostId,
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

    return this.sessionOf(context);
  }

  async launch(context: RunTargetContext, launch: RunSessionLaunch): Promise<RunDispatchRef> {
    const { run, automation, scope } = context;
    const props = {
      scope,
      userId: automation.ownerUserId,
      idempotencyKey: `automation-run:${run.id}`,
      origin: 'automation' as const,
    };
    const result =
      launch.kind === 'vendor'
        ? await this.commandBus.execute<StartCloudSessionCommand, SessionCommandResult>(
            new StartCloudSessionCommand({ ...props, input: launch.input }),
          )
        : await this.commandBus.execute<CreateSessionCommand, SessionCommandResult>(
            new CreateSessionCommand({ ...props, input: launch.input }),
          );
    return { kind: 'session', sessionId: result.sessionId };
  }

  refusalOf(error: unknown): RunRefusal | null {
    return runRefusalOf(error instanceof AppError ? error.code : undefined);
  }

  /** The session a run that passed every guard starts, or why it cannot. */
  private sessionOf(context: RunTargetContext): RunTargetDecision<RunSessionLaunch> {
    const { automation, event } = context;
    const { revision } = sessionTargetOf(automation);
    const prompt = composeRunPrompt(revision.prompt, event);
    if (prompt === null) return { kind: 'skip', reason: 'not_launchable', pause: null };
    try {
      return {
        kind: 'launch',
        input: this.mapper.toSessionLaunch(
          automation,
          runCheckout(revision.repositories, event),
          prompt,
        ),
      };
    } catch (error) {
      const refusal = this.refusalOf(error);
      if (!refusal) throw error;
      return { kind: 'skip', reason: refusal.reason, pause: refusal.pause };
    }
  }
}
