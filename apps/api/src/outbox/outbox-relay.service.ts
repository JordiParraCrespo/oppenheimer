import { hostname } from 'node:os';
import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type OutboxMessageRecord, OutboxRelay, OutboxService } from '@oppenheimer/backend-ddd';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Queue } from 'bullmq';

/**
 * NestJS host for the `OutboxRelay` from `@oppenheimer/backend-ddd`. Delivers
 * claimed rows to their real destination: `event` rows are re-emitted on the
 * in-process `EventEmitter2` bus (keyed by event class name, exactly as the
 * repositories used to emit them directly), `queue` rows are added to the
 * BullMQ queue named by `topic`.
 *
 * The relay drains on two triggers: repositories `wake()` it right after their
 * staging transaction commits (keeping happy-path latency at in-process
 * levels), and a background poll reclaims rows whose process died between
 * commit and delivery — the case the outbox exists for.
 */
@Injectable()
export class OutboxRelayService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxRelayService.name);
  private readonly relay: OutboxRelay;
  private readonly queues: ReadonlyMap<string, Queue>;

  constructor(
    outbox: OutboxService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(QUEUE_NAMES.EMAIL) emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.FILE_PROCESSING) fileProcessingQueue: Queue,
  ) {
    this.queues = new Map<string, Queue>([
      [QUEUE_NAMES.EMAIL, emailQueue],
      [QUEUE_NAMES.FILE_PROCESSING, fileProcessingQueue],
    ]);
    this.relay = new OutboxRelay(outbox, (message) => this.publish(message), {
      owner: `${hostname()}:${process.pid}`,
      logger: this.logger,
    });
  }

  onApplicationBootstrap(): void {
    this.relay.start();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.relay.stop();
  }

  private async publish(message: OutboxMessageRecord): Promise<void> {
    if (message.channel === 'queue') {
      const queue = message.topic ? this.queues.get(message.topic) : undefined;
      if (!queue) {
        throw new Error(`No BullMQ queue registered for outbox topic "${message.topic}"`);
      }
      // The outbox row id doubles as the BullMQ job id: if the process dies
      // between `queue.add` and `markProcessed`, the reclaimed row re-adds the
      // same job id and BullMQ deduplicates instead of running it twice.
      await queue.add(message.eventName, message.payload, {
        jobId: message.id,
      });
      return;
    }
    // Listeners receive the deserialized event payload — a plain object with
    // the same fields the original DomainEvent instance carried.
    await this.eventEmitter.emitAsync(message.eventName, message.payload);
  }
}
