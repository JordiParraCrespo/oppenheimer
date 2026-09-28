import { Logger } from '@nestjs/common';
import { Some } from 'oxide.ts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExternalEventSourcePort } from '../application/external-event-source.port';
import { ExternalEventSourceRegistry } from '../application/external-event-source.registry';
import { ProcessInboundDeliveryCommand } from '../commands/process-inbound-delivery/process-inbound-delivery.command';
import { ProcessInboundDeliveryCommandHandler } from '../commands/process-inbound-delivery/process-inbound-delivery.command-handler';
import type { InboundEventRepositoryPort } from '../database/inbound-event.repository.port';
import type { ExternalEvent, InboundDelivery } from '../domain/external-event.types';

const DAY = 24 * 60 * 60 * 1000;
const RECEIVED_AT = new Date('2026-09-28T12:00:00Z');

const delivery: InboundDelivery = {
  id: 'delivery-1',
  source: 'github',
  deliveryId: 'd-1',
  eventName: 'issues',
  payload: {},
  receivedAt: RECEIVED_AT,
};

function event(externalId: string, occurredAt: Date): ExternalEvent {
  return {
    source: 'github',
    type: 'issue_opened',
    externalId,
    subject: { kind: 'repository', ref: '1', name: 'acme/atlas' },
    actor: { login: 'someone', isOwnApp: false },
    attributes: {},
    context: {},
    occurredAt,
    schemaVersion: 1,
  };
}

function build(events: ExternalEvent[]) {
  const store = {
    findDelivery: vi.fn().mockResolvedValue(Some(delivery)),
    recordProcessed: vi.fn(
      async (_d: unknown, _o: unknown, stored: readonly unknown[]) => stored.length,
    ),
    markFailed: vi.fn(),
  };
  const source = {
    id: 'github',
    accepts: () => true,
    normalize: () => events,
    resolveTenants: vi.fn().mockResolvedValue(['org-1']),
  } as unknown as ExternalEventSourcePort;
  const registry = new ExternalEventSourceRegistry();
  registry.registerAll([source]);
  const handler = new ProcessInboundDeliveryCommandHandler(
    registry,
    store as unknown as InboundEventRepositoryPort,
  );
  return { handler, store, source };
}

afterEach(() => vi.restoreAllMocks());

describe('processing a delivery', () => {
  it('drops, and logs, an event older than the replay window', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const old = event('old', new Date(RECEIVED_AT.getTime() - 30 * DAY));
    const subject = build([old]);

    const stored = await subject.handler.execute(
      new ProcessInboundDeliveryCommand({ inboundDeliveryId: delivery.id }),
    );

    expect(stored).toBe(0);
    expect(subject.store.recordProcessed).toHaveBeenCalledWith(delivery, [], []);
    expect(subject.source.resolveTenants).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Dropped events older than the replay window',
        dropped: 1,
      }),
    );
  });

  it('keeps an event inside the window, a late GitHub retry among them', async () => {
    const fresh = event('fresh', new Date(RECEIVED_AT.getTime() - 60_000));
    const retried = event('retried', new Date(RECEIVED_AT.getTime() - 3 * DAY));
    const old = event('old', new Date(RECEIVED_AT.getTime() - 7 * DAY));
    const subject = build([fresh, retried, old]);

    await subject.handler.execute(
      new ProcessInboundDeliveryCommand({ inboundDeliveryId: delivery.id }),
    );

    expect(subject.store.recordProcessed).toHaveBeenCalledWith(
      delivery,
      ['org-1'],
      [fresh, retried],
    );
  });
});
