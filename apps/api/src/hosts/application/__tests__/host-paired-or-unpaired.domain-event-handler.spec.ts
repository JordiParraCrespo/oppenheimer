import { describe, expect, it, vi } from 'vitest';
import { HostPairedOrUnpairedDomainEventHandler } from '../event-handlers/host-paired-or-unpaired.domain-event-handler';

/**
 * Add host waits on its token being spent. The host has no workspace, so the
 * change is the owner's; announced to a workspace, it would reach nobody.
 */
describe('HostPairedOrUnpairedDomainEventHandler', () => {
  it('tells the owner a token was spent, on which machine, and that their list changed', () => {
    const events = { publish: vi.fn() };
    new HostPairedOrUnpairedDomainEventHandler(events).onRegistered({
      aggregateId: 'host-1',
      ownerUserId: 'jordi',
      pairingTokenId: 'token-1',
    });
    expect(events.publish.mock.calls).toEqual([
      [{ userId: 'jordi' }, { type: 'pairing.spent', id: 'token-1', hostId: 'host-1' }],
      [{ userId: 'jordi' }, { type: 'host.changed', id: 'host-1' }],
    ]);
  });

  it('tells the owner an unpaired host left their list', () => {
    const events = { publish: vi.fn() };
    new HostPairedOrUnpairedDomainEventHandler(events).onUnpaired({
      aggregateId: 'host-1',
      ownerUserId: 'jordi',
    });
    expect(events.publish).toHaveBeenCalledWith(
      { userId: 'jordi' },
      { type: 'host.changed', id: 'host-1' },
    );
  });
});
