import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, type OnApplicationBootstrap } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Queue } from 'bullmq';
import { AUTOMATION_RUN_REPOSITORY } from '../automations.di-tokens';
import { EnforceRunLimitsCommand } from '../commands/enforce-run-limits/enforce-run-limits.command';
import { FireDueSchedulesCommand } from '../commands/fire-due-schedules/fire-due-schedules.command';
import type { AutomationRunRepositoryPort } from '../database/automation-run.repository.port';

const SCHEDULER_ID = 'automation-schedules-tick';
/** A run pending this long past its time has outlived its job's retries. */
const STALLED_AFTER_MS = 10 * 60_000;
const SWEEP_BATCH = 200;

/**
 * The one-minute tick (§Q8). One BullMQ job scheduler — one Redis entry, so it
 * ticks once whatever the number of replicas — that does nothing but ask the
 * database which triggers are due. The schedules themselves live in
 * `automation_trigger.nextFireAt`, never in Redis.
 *
 * The same tick sweeps for runs still pending well past their time, whose
 * dispatch job ran out of retries or was lost with Redis, and re-stages them;
 * and stops the sessions of runs live past their workspace's run limit.
 */
@Processor(QUEUE_NAMES.AUTOMATION_SCHEDULES)
export class AutomationSchedulesProcessor extends WorkerHost implements OnApplicationBootstrap {
  constructor(
    private readonly commandBus: CommandBus,
    @Inject(AUTOMATION_RUN_REPOSITORY)
    private readonly runs: AutomationRunRepositoryPort,
    @InjectQueue(QUEUE_NAMES.AUTOMATION_SCHEDULES)
    private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(SCHEDULER_ID, { every: 60_000 }, { name: 'tick' });
  }

  async process(): Promise<{ fired: number; restaged: number; stopped: number }> {
    const now = new Date();
    const fired = await this.commandBus.execute<FireDueSchedulesCommand, number>(
      new FireDueSchedulesCommand({ now }),
    );
    const restaged = await this.runs.restageStalled(
      new Date(now.getTime() - STALLED_AFTER_MS),
      SWEEP_BATCH,
    );
    const stopped = await this.commandBus.execute<EnforceRunLimitsCommand, number>(
      new EnforceRunLimitsCommand({ now }),
    );
    return { fired, restaged, stopped };
  }
}
