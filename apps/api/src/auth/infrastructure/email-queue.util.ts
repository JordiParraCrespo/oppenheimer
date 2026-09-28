import { Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import { Queue } from 'bullmq';
import { EMAIL_JOB_OPTIONS } from '../../config/queue-options.config';

/**
 * Standalone BullMQ queue used by the Better Auth instance to enqueue
 * transactional emails (password reset, email verification, welcome).
 *
 * Better Auth is configured outside of the NestJS DI container, so it cannot
 * inject the queue provided by `@nestjs/bullmq`. Instead it pushes jobs onto
 * the same Redis queue, which is consumed by the existing `EmailProcessor`
 * worker registered in `QueueModule`.
 *
 * Job options are per producer, so this queue carries the same
 * `EMAIL_JOB_OPTIONS` (retries, then quick removal from Redis) as the
 * DI-registered one; the two must not drift.
 */
export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
  connection: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number.parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  defaultJobOptions: EMAIL_JOB_OPTIONS,
});

// A BullMQ queue is an EventEmitter, so an `error` from its Redis connection —
// a restart, a failover, a dropped idle socket — is an unhandled `error` event
// and would take the process down. The queue reconnects on its own, so log and
// carry on. This queue lives outside the DI container, so nothing else owns it.
emailQueue.on('error', (error: Error) => {
  new Logger('EmailQueue').warn(`Redis connection error: ${error.message}`);
});

/**
 * Enqueue an email without letting a queue failure reach the caller.
 *
 * For sign-up hooks the enqueue is genuinely best-effort: Better Auth does not
 * await the hook, so a rejection here escapes as an unhandled rejection rather
 * than failing anything a user would see. Handlers that *should* surface the
 * failure to the caller keep awaiting `emailQueue.add` directly.
 */
export async function enqueueEmailBestEffort(
  name: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    await emailQueue.add(name, data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    new Logger('EmailQueue').warn(`Could not enqueue "${name}" email: ${message}`);
  }
}
