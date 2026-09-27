import type { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { UserRepositoryPort } from '../../../users/database/user.repository.port';
import { HostNetworkChangedDomainEventHandler } from '../event-handlers/host-network-changed.domain-event-handler';

const FROM = {
  ip: '195.235.113.3',
  countryCode: 'ES',
  city: 'Madrid',
  asn: 3352,
  asnOrg: 'Telefonica',
};
const TO = { ip: '198.51.100.9', countryCode: 'FR', city: 'Paris', asn: 16276, asnOrg: 'OVH SAS' };
const EVENT = {
  id: 'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b',
  aggregateId: 'host-1',
  ownerUserId: 'user-1',
  hostName: 'optimus',
  from: FROM,
  to: TO,
};

function handler(options: { owner?: boolean; frontendUrl?: string } = {}) {
  const users = {
    findOneById: vi
      .fn()
      .mockResolvedValue(options.owner === false ? None : Some({ email: 'jordi@example.com' })),
  } as unknown as UserRepositoryPort;
  const queue = { add: vi.fn().mockResolvedValue(undefined) } as unknown as Queue;
  const frontendUrl =
    'frontendUrl' in options ? options.frontendUrl : 'https://app.oppenheimer.dev';
  const config = { get: () => frontendUrl } as unknown as ConfigService;
  return { subject: new HostNetworkChangedDomainEventHandler(users, queue, config), queue };
}

describe('HostNetworkChangedDomainEventHandler', () => {
  it('queues one notice per move, keyed by the event so a redelivery is not a second email', async () => {
    const { subject, queue } = handler();

    await subject.handle(EVENT);

    expect(queue.add).toHaveBeenCalledWith(
      'host-network-changed',
      {
        // `to` is the recipient on every email job; the networks are named apart.
        to: 'jordi@example.com',
        userId: 'user-1',
        hostId: 'host-1',
        hostName: 'optimus',
        fromNetwork: FROM,
        toNetwork: TO,
        url: 'https://app.oppenheimer.dev',
      },
      { jobId: `host-network-changed-${EVENT.id}` },
    );
    const [, , options] = vi.mocked(queue.add).mock.calls[0];
    expect(options?.jobId).not.toContain(':');
  });

  it('sends nothing when the owner is gone', async () => {
    const { subject, queue } = handler({ owner: false });
    await subject.handle(EVENT);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('sends nothing without a frontend URL to point at', async () => {
    const { subject, queue } = handler({ frontendUrl: undefined });
    await subject.handle(EVENT);
    expect(queue.add).not.toHaveBeenCalled();
  });
});
