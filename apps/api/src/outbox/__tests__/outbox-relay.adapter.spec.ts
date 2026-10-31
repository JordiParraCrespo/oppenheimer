import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { OutboxMessageRecord, OutboxService } from '@oppenheimer/backend-ddd';
import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { OutboxRelayService } from '../infrastructure/outbox-relay.adapter';

/**
 * How the relay delivers a claimed row: a `queue` row to the queue its topic
 * names, under the row's id as the job id, and an unknown topic as a failed
 * delivery (which the relay retries and parks). Which queues it holds is
 * `QueueModule`'s, proven in `queue-registration.spec.ts`; claiming, leases and
 * retries are `OutboxRelay`'s, proven in `outbox.integration.spec.ts`.
 */
describe('OutboxRelayService delivery', () => {
  function relayWith(queues: ReadonlyMap<string, Queue>) {
    const emitter = { emitAsync: vi.fn().mockResolvedValue([]) };
    const relay = new OutboxRelayService(
      {} as OutboxService,
      emitter as unknown as EventEmitter2,
      queues,
    );
    const publish = (message: Partial<OutboxMessageRecord>) =>
      (relay as unknown as { publish(m: OutboxMessageRecord): Promise<void> }).publish({
        id: 'row-1',
        channel: 'queue',
        eventName: 'run',
        payload: { a: 1 },
        ...message,
      } as OutboxMessageRecord);
    return { emitter, publish };
  }

  it('adds a queue row to the queue its topic names, keyed by the row id', async () => {
    const queue = { add: vi.fn().mockResolvedValue(undefined) };
    const { publish } = relayWith(new Map([['bot-turns', queue as unknown as Queue]]));

    await publish({ topic: 'bot-turns' });

    expect(queue.add).toHaveBeenCalledWith('run', { a: 1 }, { jobId: 'row-1' });
  });

  it('fails the delivery of a topic no queue was registered for', async () => {
    const { publish, emitter } = relayWith(new Map());

    await expect(publish({ topic: 'nowhere' })).rejects.toThrow(/nowhere/);
    expect(emitter.emitAsync).not.toHaveBeenCalled();
  });

  it('emits an event row on the bus under its event name', async () => {
    const { publish, emitter } = relayWith(new Map());

    await publish({ channel: 'event', eventName: 'TaskMovedDomainEvent', topic: null });

    expect(emitter.emitAsync).toHaveBeenCalledWith('TaskMovedDomainEvent', { a: 1 });
  });
});
