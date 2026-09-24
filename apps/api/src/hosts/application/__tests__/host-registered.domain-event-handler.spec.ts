import type { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { UserRepositoryPort } from '../../../users/database/user.repository.port';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import { HostRegisteredDomainEventHandler } from '../event-handlers/host-registered.domain-event-handler';

const EVENT = {
  aggregateId: 'host-1',
  ownerUserId: 'user-1',
  publicKeyFingerprint: 'f'.repeat(64),
};

function handler(options: { owner?: boolean; host?: boolean } = {}) {
  const users = {
    findOneById: vi
      .fn()
      .mockResolvedValue(options.owner === false ? None : Some({ email: 'jordi@example.com' })),
  } as unknown as UserRepositoryPort;
  const hosts = {
    findOneByIdForMachine: vi
      .fn()
      .mockResolvedValue(
        options.host === false
          ? None
          : Some({ name: 'Dev box', hostname: 'devbox.local', os: 'macos' }),
      ),
  } as unknown as HostRepositoryPort;
  const queue = { add: vi.fn().mockResolvedValue(undefined) } as unknown as Queue;
  const config = { get: () => 'https://app.oppenheimer.dev' } as unknown as ConfigService;
  return { subject: new HostRegisteredDomainEventHandler(hosts, users, queue, config), queue };
}

describe('HostRegisteredDomainEventHandler', () => {
  it('queues one notice per host, to the owner, keyed so a redelivery is not a second email', async () => {
    const { subject, queue } = handler();

    await subject.handle(EVENT);

    expect(queue.add).toHaveBeenCalledWith(
      'host-paired',
      {
        to: 'jordi@example.com',
        userId: 'user-1',
        hostName: 'Dev box',
        machine: 'devbox.local, macos',
        fingerprint: 'f'.repeat(64),
        url: 'https://app.oppenheimer.dev',
      },
      { jobId: 'host-paired:host-1' },
    );
  });

  it('sends nothing when the owner or the host is gone', async () => {
    for (const gone of [{ owner: false }, { host: false }]) {
      const { subject, queue } = handler(gone);
      await subject.handle(EVENT);
      expect(queue.add).not.toHaveBeenCalled();
    }
  });
});
