import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import { ProfileModule } from '../profile/profile.module';
import { EmailJobMapper } from './email-job.mapper';
import { EmailProcessor } from './infrastructure/email.processor';

/** Retries for work whose owing row lives in Postgres. */
const DURABLE_JOB = {
  attempts: 8,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { age: 24 * 60 * 60, count: 10_000 },
  removeOnFail: { age: 7 * 24 * 60 * 60 },
} as const;

@Module({
  imports: [
    // `LocaleResolver`: the email worker writes in the recipient's saved language.
    ProfileModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.EMAIL }),
    BullModule.registerQueue({ name: QUEUE_NAMES.FILE_PROCESSING }),
    // Queues whose jobs are staged on the outbox by other modules: the relay
    // (`outbox/infrastructure/outbox-relay.adapter.ts`) needs a handle on each.
    // The outbox marks a row processed once the job is added, so the retries
    // are the queue's: a job that throws on a transient fault (the database,
    // GitHub, a session create) is tried again with backoff. What outlives
    // the retries — or a Redis entry lost outright — is re-staged by each
    // module's sweep, from the rows that are still owed.
    BullModule.registerQueue({ name: QUEUE_NAMES.INBOUND_EVENTS, defaultJobOptions: DURABLE_JOB }),
    BullModule.registerQueue({ name: QUEUE_NAMES.AUTOMATION_RUNS, defaultJobOptions: DURABLE_JOB }),
  ],
  providers: [EmailProcessor, EmailJobMapper],
  exports: [BullModule],
})
export class QueueModule {}
