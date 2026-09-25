import type { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import type { UserRepositoryPort } from '../../../users/database/user.repository.port';
import { HostRegisteredDomainEventHandler } from '../event-handlers/host-registered.domain-event-handler';

const EVENT = {
  aggregateId: 'host-1',
  ownerUserId: 'user-1',
  publicKeyFingerprint: 'f'.repeat(64),
  name: 'Dev box',
  hostname: 'devbox.local',
  os: 'macos',
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
  return { subject: new HostRegisteredDomainEventHandler(users, queue, config), queue, users };
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
        hostId: 'host-1',
        hostName: 'Dev box',
        hostname: 'devbox.local',
        os: 'macos',
        fingerprint: 'f'.repeat(64),
        url: 'https://app.oppenheimer.dev',
      },
      { jobId: 'host-paired-host-1' },
    );
    // BullMQ refuses a custom job id containing `:`, so the mock above would
    // pass a value the real queue throws on; hold the rule here.
    const [, , options] = vi.mocked(queue.add).mock.calls[0];
    expect(options?.jobId).not.toContain(':');
  });

  it('sends nothing when the owner is gone', async () => {
    const { subject, queue } = handler({ owner: false });
    await subject.handle(EVENT);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('fails closed without a frontend URL: no job whose button goes nowhere', async () => {
    for (const frontendUrl of [undefined, '']) {
      const { subject, queue, users } = handler({ frontendUrl });
      await subject.handle(EVENT);
      expect(queue.add).not.toHaveBeenCalled();
      expect(users.findOneById).not.toHaveBeenCalled();
    }
  });
});
