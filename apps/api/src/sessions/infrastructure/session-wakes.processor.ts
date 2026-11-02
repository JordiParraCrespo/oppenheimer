import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Job } from 'bullmq';
import type { SessionWake } from '../application/session-wakes.port';
import { DeliverSessionWakeCommand } from '../commands/deliver-session-wake/deliver-session-wake.command';
import { SESSION_WAKE_SOURCES, type SessionWakeSource } from '../domain/session-prompt.policy';
import { DELIVER_SESSION_WAKE_JOB } from './outbox-session-wakes.adapter';

/**
 * The `session-wakes` worker: one job per wake, staged on the outbox for its
 * time. The queue retries a job that throws (`DURABLE_JOB_OPTIONS`); the
 * prompt it types is claimed by the wake's id, so a retry types it once.
 */
@Processor(QUEUE_NAMES.SESSION_WAKES)
export class SessionWakesProcessor extends WorkerHost {
  private readonly logger = new Logger(SessionWakesProcessor.name);

  constructor(private readonly commandBus: CommandBus) {
    super();
  }

  async process(job: Job<Partial<SessionWake>>): Promise<void> {
    const { sessionId, wakeId, source, text, attempt } = job.data;
    if (
      job.name !== DELIVER_SESSION_WAKE_JOB ||
      !sessionId ||
      !wakeId ||
      !source ||
      !SESSION_WAKE_SOURCES.includes(source as SessionWakeSource) ||
      !text ||
      !Number.isInteger(attempt)
    ) {
      this.logger.warn({ message: 'Unknown session-wakes job', jobName: job.name, jobId: job.id });
      return;
    }
    await this.commandBus.execute(
      new DeliverSessionWakeCommand({
        wake: { sessionId, wakeId, source, text, attempt: attempt as number },
      }),
    );
  }
}
