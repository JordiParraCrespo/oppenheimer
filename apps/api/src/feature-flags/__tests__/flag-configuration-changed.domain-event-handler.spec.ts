import { describe, expect, it } from 'vitest';
import { FlagConfigurationChangedDomainEventHandler } from '../application/event-handlers/flag-configuration-changed.domain-event-handler';
import { FlagConfigurationChangedDomainEvent } from '../domain/events/flag-configuration-changed.domain-event';

/** Where `@OnEvent` records its listeners; `@nestjs/event-emitter` does not export the key. */
const EVENT_LISTENER_METADATA = 'EVENT_LISTENER_METADATA';

describe('FlagConfigurationChangedDomainEventHandler', () => {
  it('lets a failure reach the outbox relay, which retries the delivery', () => {
    const listeners = Reflect.getMetadata(
      EVENT_LISTENER_METADATA,
      FlagConfigurationChangedDomainEventHandler.prototype.handle,
    );

    expect(listeners).toEqual([
      {
        event: FlagConfigurationChangedDomainEvent.name,
        options: { suppressErrors: false },
      },
    ]);
  });
});
