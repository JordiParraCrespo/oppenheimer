import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AutomationSkipReason } from '@oppenheimer/shared/automations';
import { AutomationLimitsResolver } from '../../application/automation-limits.resolver';
import { RoutineWebhookResolver } from '../../application/routine-webhook.resolver';
import {
  AUTOMATION_RUN_REPOSITORY,
  AUTOMATION_WEBHOOK_REPOSITORY,
} from '../../automations.di-tokens';
import type { AutomationRunRepositoryPort } from '../../database/automation-run.repository.port';
import type { AutomationWebhookRepositoryPort } from '../../database/automation-webhook.repository.port';
import { AutomationRunEntity } from '../../domain/automation-run.entity';
import { AutomationErrors } from '../../domain/automations.errors';
import { rateGuard } from '../../domain/fire-guard.policy';
import { webhookPayloadOf } from '../../domain/routine-webhook.policy';
import { webhookCauseSummary } from '../../domain/run-launch.policy';
import { ReceiveRoutineWebhookCommand } from './receive-routine-webhook.command';

const HOUR = 60 * 60 * 1000;
/** The longest `Idempotency-Key` kept as part of a run's cause key. */
const IDEMPOTENCY_KEY_MAX = 128;

export interface ReceivedWebhook {
  runId: string;
  /**
   * `queued` when it will run; `skipped` when an hourly cap turned it away (and
   * recorded it); `duplicate` when an earlier POST with the same
   * `Idempotency-Key` already made this run.
   */
  status: 'queued' | 'skipped' | 'duplicate';
  skipReason: AutomationSkipReason | null;
}

/**
 * A POST to a routine's URL becomes one run of that routine, answered at once
 * with the run's id: the bot's turn is queued, never waited on. The body is
 * kept with the run (capped) and reaches the bot as outside data.
 *
 * Refused before any run exists: an unknown URL or a bad signature
 * (`RoutineWebhookResolver`), and a paused routine (409). Past those, the
 * hourly caps of the routine and the workspace are the event triggers' own
 * (`rateGuard`): a firing over them is a recorded skip. A run already in
 * progress and a provider with no key are the dispatcher's, as for any run.
 */
@CommandHandler(ReceiveRoutineWebhookCommand)
export class ReceiveRoutineWebhookCommandHandler
  implements ICommandHandler<ReceiveRoutineWebhookCommand, ReceivedWebhook>
{
  constructor(
    private readonly targets: RoutineWebhookResolver,
    @Inject(AUTOMATION_WEBHOOK_REPOSITORY)
    private readonly webhooks: AutomationWebhookRepositoryPort,
    @Inject(AUTOMATION_RUN_REPOSITORY)
    private readonly runs: AutomationRunRepositoryPort,
    private readonly limits: AutomationLimitsResolver,
  ) {}

  async execute(command: ReceiveRoutineWebhookCommand): Promise<ReceivedWebhook> {
    const now = new Date();
    const { routine, trigger } = await this.targets.require(command, now);
    if (routine.isPaused) throw new AppError(AutomationErrors.WEBHOOK_ROUTINE_PAUSED);

    const props = {
      organizationId: routine.organizationId,
      automationId: routine.id,
      revisionId: routine.revision.id,
      triggerId: trigger.id,
      cause: 'event' as const,
      causeKey: `webhook:${causeKeyOf(command)}`,
      causeSummary: webhookCauseSummary(),
      inboundEventId: null,
      webhookPayload: webhookPayloadOf(command.body, command.contentType),
      scheduledFor: null,
      requestedByUserId: null,
    };
    const limits = await this.limits.resolve(routine.organizationId, routine);
    const { run, runId, inserted } = await this.runs.fireUnderCaps(
      routine.organizationId,
      routine.id,
      new Date(now.getTime() - HOUR),
      (recent) => {
        const verdict = rateGuard(limits, recent, false);
        return verdict.kind === 'skip'
          ? AutomationRunEntity.skipped(props, verdict.reason, now)
          : AutomationRunEntity.fire(props, now);
      },
      command.metadata.correlationId,
    );
    await this.webhooks.markReceived(routine.organizationId, routine.id, now);
    if (!inserted) return { runId, status: 'duplicate', skipReason: null };
    const skipped = run.outcome === 'skipped';
    return {
      runId,
      status: skipped ? 'skipped' : 'queued',
      skipReason: skipped ? run.skipReason : null,
    };
  }
}

/** The sender's key when it gave one, so a retry is the same run; else this request alone. */
function causeKeyOf(command: ReceiveRoutineWebhookCommand): string {
  const key = command.idempotencyKey?.trim();
  return key ? `key:${key.slice(0, IDEMPOTENCY_KEY_MAX)}` : `request:${command.id}`;
}
