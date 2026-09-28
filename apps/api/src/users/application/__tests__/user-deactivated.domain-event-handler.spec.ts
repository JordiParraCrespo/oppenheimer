import { describe, expect, it, vi } from 'vitest';
import type { UserDeactivatedDomainEvent } from '../../domain/events/user-deactivated.domain-event';
import type { AccountSessionsPort } from '../account-sessions.port';
import { UserDeactivatedDomainEventHandler } from '../event-handlers/user-deactivated.domain-event-handler';

describe('UserDeactivatedDomainEventHandler', () => {
  it("revokes the deactivated account's sessions once", async () => {
    const sessions: AccountSessionsPort = { revokeAll: vi.fn().mockResolvedValue(undefined) };
    const handler = new UserDeactivatedDomainEventHandler(sessions);

    // The outbox relay delivers the payload, a plain object, not the class.
    const payload = { aggregateId: 'user-uuid', reason: 'Account deactivated' };
    await handler.handle(payload as unknown as UserDeactivatedDomainEvent);

    expect(sessions.revokeAll).toHaveBeenCalledExactlyOnceWith('user-uuid');
  });

  it('fails when the revocation fails, so the relay retries it', async () => {
    const sessions: AccountSessionsPort = {
      revokeAll: vi.fn().mockRejectedValue(new Error('database unavailable')),
    };
    const handler = new UserDeactivatedDomainEventHandler(sessions);

    await expect(
      handler.handle({ aggregateId: 'user-uuid' } as unknown as UserDeactivatedDomainEvent),
    ).rejects.toThrow('database unavailable');
  });
});
