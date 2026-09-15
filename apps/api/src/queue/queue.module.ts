import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import { ProfileModule } from '../profile/profile.module';
import { EmailProcessor } from './email.processor';
import { EmailJobMapper } from './email-job.mapper';

@Module({
  imports: [
    // `LocaleResolver`: the email worker writes in the recipient's saved language.
    ProfileModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.EMAIL }),
    BullModule.registerQueue({ name: QUEUE_NAMES.FILE_PROCESSING }),
  ],
  providers: [EmailProcessor, EmailJobMapper],
  exports: [BullModule],
})
export class QueueModule {}
