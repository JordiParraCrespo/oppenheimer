import { BullModule, getQueueToken, type RegisterQueueOptions } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Queue } from 'bullmq';
import {
  BOT_TURN_JOB_OPTIONS,
  DURABLE_JOB_OPTIONS,
  EMAIL_JOB_OPTIONS,
} from '../config/queue-options.config';
import { ProfileModule } from '../profile/profile.module';
import { EmailJobMapper } from './email-job.mapper';
import { EmailProcessor } from './infrastructure/email.processor';
import { OUTBOX_QUEUES } from './queue.di-tokens';

interface QueueRegistration extends RegisterQueueOptions {
  name: string;
  /**
   * Other modules stage its jobs on the outbox (`OutboxService.stageJob`), so
   * the relay holds a handle on it. A `queue` row whose topic is not one of
   * these fails delivery, is retried and then parked.
   */
  stagedOnOutbox?: true;
}

const QUEUE_REGISTRATIONS: readonly QueueRegistration[] = [
  { name: QUEUE_NAMES.EMAIL, defaultJobOptions: EMAIL_JOB_OPTIONS, stagedOnOutbox: true },
  // The retries of a queue the outbox feeds are the queue's (see `DURABLE_JOB_OPTIONS`).
  {
    name: QUEUE_NAMES.INBOUND_EVENTS,
    defaultJobOptions: DURABLE_JOB_OPTIONS,
    stagedOnOutbox: true,
  },
  {
    name: QUEUE_NAMES.AUTOMATION_RUNS,
    defaultJobOptions: DURABLE_JOB_OPTIONS,
    stagedOnOutbox: true,
  },
  { name: QUEUE_NAMES.BOT_TURNS, defaultJobOptions: BOT_TURN_JOB_OPTIONS, stagedOnOutbox: true },
  // An approved call is keyed by its approval, so a retry runs it once.
  { name: QUEUE_NAMES.BOT_APPROVALS, defaultJobOptions: DURABLE_JOB_OPTIONS, stagedOnOutbox: true },
  // A summary write is conditional on the version it read, so a retry never moves it back.
  { name: QUEUE_NAMES.BOT_SUMMARIES, defaultJobOptions: DURABLE_JOB_OPTIONS, stagedOnOutbox: true },
  // A stall check queues its wake under a key, so a retry tells the bot once.
  {
    name: QUEUE_NAMES.BOT_STALL_CHECKS,
    defaultJobOptions: DURABLE_JOB_OPTIONS,
    stagedOnOutbox: true,
  },
  // Scheduler-driven queues (the automation tick, the daily purges): the
  // root defaults from `app.module.ts`.
  { name: QUEUE_NAMES.HOST_RETENTION },
  { name: QUEUE_NAMES.AUTOMATION_SCHEDULES },
  { name: QUEUE_NAMES.AUTOMATION_RETENTION },
  { name: QUEUE_NAMES.OUTBOX_RETENTION },
  { name: QUEUE_NAMES.BOT_ATTACHMENT_RETENTION },
  { name: QUEUE_NAMES.MAIL_MINUTE },
];

const OUTBOX_QUEUE_NAMES = QUEUE_REGISTRATIONS.filter((queue) => queue.stagedOnOutbox).map(
  (queue) => queue.name,
);

/**
 * The only place a BullMQ queue is registered. A module that adds jobs to a
 * queue, or runs its worker, imports this module; it never calls
 * `BullModule.registerQueue` itself. Registrations with different options
 * become separate `Queue` instances — each with its own options and its own
 * Redis connection — and `@InjectQueue` hands a provider whichever one its own
 * module imported, so a second registration silently drops retries and
 * retention. Exporting `BullModule` re-exports every queue token below.
 *
 * It also hands the outbox relay its queues (`OUTBOX_QUEUES`): a queue whose
 * jobs are staged on the outbox says so in its registration, and the relay
 * needs no edit for it.
 */
@Module({
  imports: [
    // `LocaleResolver`: the email worker writes in the recipient's saved language.
    ProfileModule,
    BullModule.registerQueue(...QUEUE_REGISTRATIONS.map(({ stagedOnOutbox, ...queue }) => queue)),
  ],
  providers: [
    EmailProcessor,
    EmailJobMapper,
    {
      provide: OUTBOX_QUEUES,
      useFactory: (...queues: Queue[]): ReadonlyMap<string, Queue> =>
        new Map(OUTBOX_QUEUE_NAMES.map((name, index) => [name, queues[index]])),
      inject: OUTBOX_QUEUE_NAMES.map((name) => getQueueToken(name)),
    },
  ],
  exports: [BullModule, OUTBOX_QUEUES],
})
export class QueueModule {}
