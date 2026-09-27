import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import { ProfileModule } from '../profile/profile.module';
import { EmailJobMapper } from './email-job.mapper';
import { EmailProcessor } from './infrastructure/email.processor';

@Module({
  imports: [
    // `LocaleResolver`: the email worker writes in the recipient's saved language.
    ProfileModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.EMAIL }),
    BullModule.registerQueue({ name: QUEUE_NAMES.FILE_PROCESSING }),
    // Queues whose jobs are staged on the outbox by other modules: the relay
    // (`outbox/infrastructure/outbox-relay.adapter.ts`) needs a handle on each.
    BullModule.registerQueue({ name: QUEUE_NAMES.INBOUND_EVENTS }),
    BullModule.registerQueue({ name: QUEUE_NAMES.AUTOMATION_RUNS }),
  ],
  providers: [EmailProcessor, EmailJobMapper],
  exports: [BullModule],
})
export class QueueModule {}
