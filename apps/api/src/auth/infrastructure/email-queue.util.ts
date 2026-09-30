import { Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import { Queue } from 'bullmq';
import { EMAIL_JOB_OPTIONS } from '../../config/queue-options.config';
import { redisConfigFromEnv, redisConnectionOptions } from '../../config/redis.config';

/**
 * BullMQ queue the Better Auth instance enqueues transactional emails on,
 * consumed by the `EmailProcessor` worker in `QueueModule`. Better Auth cannot
 * inject the `@nestjs/bullmq` queue (see `dispatchFromAuthHook`).
 *
 * Job options are per producer, so this carries the same `EMAIL_JOB_OPTIONS`
 * as the DI-registered queue; the two must not drift. Outside the DI container
 * `app.close()` does not reach it: a test closes it before its Redis container
 * stops, or in-flight ioredis commands reject into nothing.
 */
export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
  // Read from the environment rather than `ConfigService`, which does not exist
  // yet at module scope; the same parse as the `redis` section, so the two
  // cannot disagree about where Redis is.
  connection: redisConnectionOptions(redisConfigFromEnv()),
  defaultJobOptions: EMAIL_JOB_OPTIONS,
});

// A BullMQ queue is an EventEmitter, so an `error` from its Redis connection —
// a restart, a failover, a dropped idle socket — is an unhandled `error` event
// and would take the process down. The queue reconnects on its own, so log and
// carry on.
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
