/**
 * The hub's event reaches the automations as a command that carries the
 * event's correlation id, so the run it fires, and the dispatch job staged
 * for it, stay traceable to the delivery that raised the event. The outbox
 * hands the handler the deserialized payload, metadata included.
 */
import type { CommandBus } from '@nestjs/cqrs';
import { describe, expect, it, vi } from 'vitest';
import { ExternalEventReceivedDomainEvent } from '../../inbound-events/domain/events/external-event-received.domain-event';
import { ExternalEventReceivedDomainEventHandler } from '../application/event-handlers/external-event-received.domain-event-handler';
import type { FireEventTriggersCommand } from '../commands/fire-event-triggers/fire-event-triggers.command';

describe('ExternalEventReceivedDomainEventHandler', () => {
  it("fires the triggers under the event's correlation id, not a fresh one", async () => {
    const execute = vi.fn(async () => 0);
    const handler = new ExternalEventReceivedDomainEventHandler({
      execute,
    } as unknown as CommandBus);
    const event = new ExternalEventReceivedDomainEvent({
      aggregateId: 'event-1',
      organizationId: 'org-1',
      source: 'github',
      eventType: 'pr_opened',
      subjectKind: 'repository',
      subjectRef: '101',
      actorLogin: 'octocat',
      actorIsOwnApp: false,
      attributes: {},
      externalId: 'delivery-1',
      occurredAt: '2026-10-08T12:00:00.000Z',
      metadata: { correlationId: 'webhook-corr' },
    });

    // What the relay delivers: the event as JSON, not the instance.
    await handler.handle(JSON.parse(JSON.stringify(event)));

    const [command] = execute.mock.calls[0] as unknown as [FireEventTriggersCommand];
    expect(command.metadata.correlationId).toBe('webhook-corr');
    expect(command.inboundEventId).toBe('event-1');
  });
});
