import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import { DURABLE_JOB_OPTIONS, EMAIL_JOB_OPTIONS } from '../config/queue-options.config';
import { ProfileModule } from '../profile/profile.module';
import { EmailJobMapper } from './email-job.mapper';
import { EmailProcessor } from './infrastructure/email.processor';

/**
 * The only place a BullMQ queue is registered. A module that adds jobs to a
 * queue, or runs its worker, imports this module; it never calls
 * `BullModule.registerQueue` itself. Registrations with different options
 * become separate `Queue` instances — each with its own options and its own
 * Redis connection — and `@InjectQueue` hands a provider whichever one its own
 * module imported, so a second registration silently drops retries and
 * retention. Exporting `BullModule` re-exports every queue token below.
 */
@Module({
  imports: [
    // `LocaleResolver`: the email worker writes in the recipient's saved language.
    ProfileModule,
    BullModule.registerQueue(
      { name: QUEUE_NAMES.EMAIL, defaultJobOptions: EMAIL_JOB_OPTIONS },
      // Queues whose jobs are staged on the outbox by other modules: the relay
      // (`outbox/infrastructure/outbox-relay.adapter.ts`) needs a handle on
      // each, and the retries are the queue's (see `DURABLE_JOB_OPTIONS`).
      { name: QUEUE_NAMES.INBOUND_EVENTS, defaultJobOptions: DURABLE_JOB_OPTIONS },
      { name: QUEUE_NAMES.AUTOMATION_RUNS, defaultJobOptions: DURABLE_JOB_OPTIONS },
      // Scheduler-driven queues (the automation tick, the daily purges): the
      // root defaults from `app.module.ts`.
      { name: QUEUE_NAMES.HOST_RETENTION },
      { name: QUEUE_NAMES.AUTOMATION_SCHEDULES },
      { name: QUEUE_NAMES.AUTOMATION_RETENTION },
      { name: QUEUE_NAMES.OUTBOX_RETENTION },
    ),
  ],
  providers: [EmailProcessor, EmailJobMapper],
  exports: [BullModule],
})
export class QueueModule {}
