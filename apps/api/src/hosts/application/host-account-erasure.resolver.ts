import { Inject, Injectable } from '@nestjs/common';
import type { AccountErasurePort } from '../../users/application/account-erasure.port';
import type { HostRepositoryPort } from '../database/host.repository.port';
import { HOST_REPOSITORY } from '../hosts.di-tokens';

/**
 * What deleting an account does to its machines: unpairs each one, exactly
 * as Remove host does. `HostUnpairedDomainEvent` then stops the sessions on
 * it and closes its link with the terminal code, so a runner that is up
 * stops its agents and stops dialling. The rows themselves go with the user.
 */
@Injectable()
export class HostAccountErasure implements AccountErasurePort {
  readonly step = 'hosts' as const;

  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
  ) {}

  async eraseFor(userId: string): Promise<void> {
    for (const host of await this.hosts.findOwnedBySystem(userId)) {
      if (host.isUnpaired) continue;
      host.unpair();
      await this.hosts.save(host);
    }
  }
}
