import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { type OnApplicationBootstrap } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Queue } from 'bullmq';
import { FireDueSchedulesCommand } from '../commands/fire-due-schedules/fire-due-schedules.command';

const SCHEDULER_ID = 'automation-schedules-tick';

/**
 * The one-minute tick (§Q8). One BullMQ job scheduler — one Redis entry, so it
 * ticks once whatever the number of replicas — that does nothing but ask the
 * database which triggers are due. The schedules themselves live in
 * `automation_trigger.nextFireAt`, never in Redis.
 */
@Processor(QUEUE_NAMES.AUTOMATION_SCHEDULES)
export class AutomationSchedulesProcessor extends WorkerHost implements OnApplicationBootstrap {
  constructor(
    private readonly commandBus: CommandBus,
    @InjectQueue(QUEUE_NAMES.AUTOMATION_SCHEDULES)
    private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(SCHEDULER_ID, { every: 60_000 }, { name: 'tick' });
  }

  process(): Promise<number> {
    return this.commandBus.execute(new FireDueSchedulesCommand({ now: new Date() }));
  }
}
