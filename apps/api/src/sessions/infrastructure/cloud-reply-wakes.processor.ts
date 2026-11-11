import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Job } from 'bullmq';
import { WakeCloudSessionCommand } from '../commands/wake-cloud-session/wake-cloud-session.command';
import type { WakeCloudSessionResult } from '../commands/wake-cloud-session/wake-cloud-session.command-handler';
import { WAKE_CLOUD_SESSION_JOB } from '../database/session-cloud-chat.repository';
import type { CloudReplyWake } from '../database/session-cloud-chat.repository.port';

/**
 * The `cloud-reply-wakes` worker: one job per reply, staged on the outbox with
 * the reply for when the Stop hook has had its time. A job that throws is
 * retried (`DURABLE_JOB_OPTIONS`); the reply is claimed before it is sent, so
 * a retry after a send finds it taken and sends nothing.
 */
@Processor(QUEUE_NAMES.CLOUD_REPLY_WAKES)
export class CloudReplyWakesProcessor extends WorkerHost {
  private readonly logger = new Logger(CloudReplyWakesProcessor.name);

  constructor(private readonly commandBus: CommandBus) {
    super();
  }

  async process(job: Job<Partial<CloudReplyWake>>): Promise<WakeCloudSessionResult | null> {
    const { sessionId, replyId } = job.data;
    if (job.name !== WAKE_CLOUD_SESSION_JOB || !sessionId || !replyId) {
      this.logger.warn({
        message: 'Unknown cloud-reply-wakes job',
        jobName: job.name,
        jobId: job.id,
      });
      return null;
    }
    return this.commandBus.execute<WakeCloudSessionCommand, WakeCloudSessionResult>(
      new WakeCloudSessionCommand({ wake: { sessionId, replyId } }),
    );
  }
}
