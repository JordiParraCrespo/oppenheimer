import { Inject, Injectable } from '@nestjs/common';
import type { HostRepositoryPort } from '../database/host.repository.port';
import { HOST_REPOSITORY } from '../hosts.di-tokens';
import type { HostOwnerPort } from './host-owner.port';

@Injectable()
export class HostOwnerResolver implements HostOwnerPort {
  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
  ) {}

  async ownerOf(hostId: string): Promise<string | null> {
    const found = await this.hosts.findOneByIdForMachine(hostId);
    return found.isSome() ? found.unwrap().ownerUserId : null;
  }
}
