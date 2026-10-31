import { Inject, Injectable } from '@nestjs/common';
import { retryOnVersionConflict } from '@oppenheimer/backend-ddd';
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
    for (const listed of await this.hosts.findOwnedBySystem(userId)) {
      if (listed.isUnpaired) continue;
      // Each try reads the host afresh, so one that another writer changed
      // since the list was read is unpaired from what it is now.
      await retryOnVersionConflict(async () => {
        const found = await this.hosts.findOneByIdForMachine(listed.id);
        if (found.isNone() || found.unwrap().isUnpaired) return;
        const host = found.unwrap();
        host.unpair();
        await this.hosts.save(host);
      });
    }
  }
}
