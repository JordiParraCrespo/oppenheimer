import { Inject, Injectable } from '@nestjs/common';
import type { HostRepositoryPort } from '../database/host.repository.port';
import { HOST_REPOSITORY } from '../hosts.di-tokens';
import type { HostKeyPort } from './host-key.port';

@Injectable()
export class HostKeyResolver implements HostKeyPort {
  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
  ) {}

  async publicKeyOf(hostId: string): Promise<string | null> {
    const found = await this.hosts.findOneByIdForMachine(hostId);
    if (found.isNone() || found.unwrap().isUnpaired) return null;
    return found.unwrap().publicKey;
  }
}
