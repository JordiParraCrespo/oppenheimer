import { Inject, Injectable } from '@nestjs/common';
import type { HostMetadataRepositoryPort } from '../database/host-metadata.repository.port';
import { HOST_METADATA_REPOSITORY } from '../hosts.di-tokens';
import type { HostVitalsPort } from './host-vitals.port';

@Injectable()
export class HostVitalsResolver implements HostVitalsPort {
  constructor(
    @Inject(HOST_METADATA_REPOSITORY)
    private readonly metadata: HostMetadataRepositoryPort,
  ) {}

  async lastFreeDisk(hostId: string): Promise<number | null> {
    const found = await this.metadata.findForHosts([hostId]);
    return found.get(hostId)?.vitals?.diskFreeBytes ?? null;
  }
}
