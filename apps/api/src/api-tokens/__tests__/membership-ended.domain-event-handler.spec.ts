/**
 * A membership ending revokes the tokens pinned to that organization. The
 * revocation must reach the outbox relay when it fails, so the delivery is
 * retried: swallowed, the event is marked delivered with the tokens live,
 * and re-adding the person makes them work again.
 */
import { describe, expect, it } from 'vitest';
import { MembershipEndedDomainEvent } from '../../organizations/domain/events/membership-ended.domain-event';
import { MembershipEndedDomainEventHandler } from '../application/event-handlers/membership-ended.domain-event-handler';

/** Where `@OnEvent` records its listeners; `@nestjs/event-emitter` does not export the key. */
const EVENT_LISTENER_METADATA = 'EVENT_LISTENER_METADATA';

describe('MembershipEndedDomainEventHandler', () => {
  it('lets a failed revocation reach the outbox relay, which retries the delivery', () => {
    const listeners = Reflect.getMetadata(
      EVENT_LISTENER_METADATA,
      MembershipEndedDomainEventHandler.prototype.handle,
    );

    expect(listeners).toEqual([
      { event: MembershipEndedDomainEvent.name, options: { suppressErrors: false } },
    ]);
  });
});
