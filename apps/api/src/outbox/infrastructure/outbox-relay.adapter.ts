import { hostname } from 'node:os';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type OutboxMessageRecord, OutboxRelay, OutboxService } from '@oppenheimer/backend-ddd';
import type { Queue } from 'bullmq';
import { OUTBOX_QUEUES } from '../../queue/queue.di-tokens';

/**
 * NestJS host for the `OutboxRelay` from `@oppenheimer/backend-ddd`: `event` rows are
 * re-emitted on the in-process `EventEmitter2` bus keyed by event class name, `queue`
 * rows are added to the BullMQ queue named by `topic`.
 *
 * `OutboxService` wakes it right after a staging transaction commits, so delivery
 * stays in-process fast without the request waiting on it; a background poll reclaims
 * rows whose process died between commit and delivery, the case the outbox exists for.
 */
@Injectable()
export class OutboxRelayService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxRelayService.name);
  private readonly relay: OutboxRelay;

  constructor(
    outbox: OutboxService,
    private readonly eventEmitter: EventEmitter2,
    // Every queue `QueueModule` registers as `stagedOnOutbox`, keyed by name.
    @Inject(OUTBOX_QUEUES) private readonly queues: ReadonlyMap<string, Queue>,
  ) {
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
