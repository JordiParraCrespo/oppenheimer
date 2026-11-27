/**
 * A password reset takes credentials back through outbox listeners in three
 * modules. For hosts and webhook URLs those listeners are the only thing that
 * takes them back, so each must let a failure reach the outbox relay, which
 * retries the delivery. Swallowed (Nest's default), the event would be marked
 * delivered with a squatter's host paired or URL live for good.
 */
import { describe, expect, it } from 'vitest';
import { PasswordResetDomainEventHandler } from '../api-tokens/application/event-handlers/password-reset.domain-event-handler';
import { PasswordResetDomainEvent } from '../auth/domain/events/password-reset.domain-event';
import { PasswordResetRevokesWebhooksDomainEventHandler } from '../automations/application/event-handlers/password-reset.domain-event-handler';
import { PasswordResetUnpairsHostsDomainEventHandler } from '../hosts/application/event-handlers/password-reset.domain-event-handler';

/** Where `@OnEvent` records its listeners; `@nestjs/event-emitter` does not export the key. */
const EVENT_LISTENER_METADATA = 'EVENT_LISTENER_METADATA';

describe('the listeners a password reset takes credentials back through', () => {
  it.each([
    ['API tokens', PasswordResetDomainEventHandler],
    ['paired hosts', PasswordResetUnpairsHostsDomainEventHandler],
    ['webhook URLs', PasswordResetRevokesWebhooksDomainEventHandler],
  ])('let a failure taking back %s reach the outbox relay, which retries', (_what, handler) => {
    expect(Reflect.getMetadata(EVENT_LISTENER_METADATA, handler.prototype.handle)).toEqual([
      { event: PasswordResetDomainEvent.name, options: { suppressErrors: false } },
    ]);
  });
});
