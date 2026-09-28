import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AutomationLimitsResolver } from '../../application/automation-limits.resolver';
import { AUTOMATION_REPOSITORY } from '../../automations.di-tokens';
import type {
  AutomationRepositoryPort,
  DueScheduleDecision,
  FiringContext,
  TriggerCandidate,
} from '../../database/automation.repository.port';
import { AutomationRunEntity } from '../../domain/automation-run.entity';
import { firstRefusal, missedSlotGuard, rateGuard } from '../../domain/fire-guard.policy';
import { scheduleCauseSummary } from '../../domain/run-launch.policy';
import { nextFireOf } from '../../domain/trigger-config.policy';
import { FireDueSchedulesCommand } from './fire-due-schedules.command';

const HOUR = 60 * 60 * 1000;

/**
 * The scheduler (§Q8). The database is the truth: due triggers are claimed
 * under a row lock, each owes at most one run for the slot it reached — keyed
 * by `(trigger, slot)` — and its next slot is computed **from now**, so an
 * outage of a day fires one late run within the grace, or records one missed
 * slot, and never a burst. The repository reads what each trigger is weighed
 * against inside its claim, so deciding is pure and does no I/O.
 */
@CommandHandler(FireDueSchedulesCommand)
export class FireDueSchedulesCommandHandler
  implements ICommandHandler<FireDueSchedulesCommand, number>
{
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
    private readonly limits: AutomationLimitsResolver,
  ) {}

  async execute(command: FireDueSchedulesCommand): Promise<number> {
    const { now } = command;
    const queued = await this.automations.fireDueSchedules(
      now,
      this.limits.schedulerBatch,
      new Date(now.getTime() - HOUR),
      (candidate, scheduledFor, context) => this.decide(candidate, scheduledFor, context, now),
    );
    return queued.length;
  }

  private decide(
    { automation, trigger }: TriggerCandidate,
    scheduledFor: Date,
    context: FiringContext,
    now: Date,
  ): DueScheduleDecision {
    if (trigger.source !== 'schedule') return { run: null, nextFireAt: null };
    const nextFireAt =
      automation.isPaused || automation.isDeleted ? null : nextFireOf(trigger, now);
    if (automation.isPaused || automation.isDeleted) return { run: null, nextFireAt };

    const limits = this.limits.resolveWith(context.workspace, automation);
    const verdict = firstRefusal(
      () => missedSlotGuard(scheduledFor, now, limits),
      () => rateGuard(limits, context.recent, false),
    );
    const props = {
      organizationId: automation.organizationId,
      automationId: automation.id,
      revisionId: automation.revision.id,
      triggerId: trigger.id,
      cause: 'schedule' as const,
      causeKey: `schedule:${trigger.id}:${scheduledFor.toISOString()}`,
      causeSummary: scheduleCauseSummary(trigger),
      inboundEventId: null,
      scheduledFor,
      requestedByUserId: null,
    };
    const run =
      verdict.kind === 'skip'
        ? AutomationRunEntity.skipped(props, verdict.reason, now)
        : AutomationRunEntity.fire(props, now);
    return { run, nextFireAt };
  }
}
