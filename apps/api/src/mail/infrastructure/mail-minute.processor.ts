import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Queue } from 'bullmq';
import { PollWatchedMailCommand } from '../commands/poll-watched-mail/poll-watched-mail.command';
import { SendDueMailCommand } from '../commands/send-due-mail/send-due-mail.command';

const SCHEDULER_ID = 'mail-minute-tick';

/**
 * Mail's one-minute tick (`product/next-steps/mail.md` §3.4, §5): sends the
 * scheduled mail that is due, then reads the new mail of every account a
 * routine watches. One BullMQ job scheduler is one Redis entry, so
 * it ticks once however many replicas there are; what is due lives in
 * `mail_send.scheduledFor`, never in Redis, so a lost Redis loses no send.
 */
@Processor(QUEUE_NAMES.MAIL_MINUTE)
export class MailMinuteProcessor extends WorkerHost implements OnApplicationBootstrap {
  constructor(
    private readonly commandBus: CommandBus,
    @InjectQueue(QUEUE_NAMES.MAIL_MINUTE) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(SCHEDULER_ID, { every: 60_000 }, { name: 'tick' });
  }

  async process(): Promise<{ sent: number; delivered: number }> {
    const now = new Date();
    const sent = await this.commandBus.execute<SendDueMailCommand, number>(
      new SendDueMailCommand({ now }),
    );
    const delivered = await this.commandBus.execute<PollWatchedMailCommand, number>(
      new PollWatchedMailCommand({ now }),
    );
    return { sent, delivered };
  }
}
