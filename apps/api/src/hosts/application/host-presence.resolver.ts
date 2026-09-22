import { Inject, Injectable } from '@nestjs/common';
import type { HostFactsDto } from '@oppenheimer/shared';
import type { HostRepositoryPort } from '../database/host.repository.port';
import { HOST_REPOSITORY } from '../hosts.di-tokens';
import type { HostPresencePort } from './host-presence.port';

@Injectable()
export class HostPresenceResolver implements HostPresencePort {
  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
  ) {}

  async observe(hostId: string, facts: HostFactsDto | null, at: Date = new Date()): Promise<void> {
    // Unscoped, by design: the machine proved who it is with a signature on the
    // link, and there is no person on a heartbeat to scope by.
    const found = await this.hosts.findOneByIdForMachine(hostId);
    if (found.isNone()) return;
    const host = found.unwrap();
    if (host.isUnpaired) return;
    host.observe(
      {
        facts: facts
          ? {
              hostname: facts.hostname,
              os: facts.osVersion ? `${facts.platform} ${facts.osVersion}` : facts.platform,
              arch: facts.arch,
              runnerVersion: facts.runnerVersion,
              capabilities: { ...facts },
            }
          : null,
      },
      at,
    );
    await this.hosts.save(host);
  }
}
