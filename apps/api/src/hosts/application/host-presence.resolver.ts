import { Inject, Injectable } from '@nestjs/common';
import type { HostRepositoryPort } from '../database/host.repository.port';
import type { HostMetadataRepositoryPort } from '../database/host-metadata.repository.port';
import { inventoryFromFacts } from '../domain/host-inventory.policy';
import { HOST_METADATA_REPOSITORY, HOST_REPOSITORY } from '../hosts.di-tokens';
import type { HostPresencePort, PresenceReport } from './host-presence.port';

@Injectable()
export class HostPresenceResolver implements HostPresencePort {
  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
    @Inject(HOST_METADATA_REPOSITORY)
    private readonly metadata: HostMetadataRepositoryPort,
  ) {}

  async observe(hostId: string, report: PresenceReport, at: Date = new Date()): Promise<boolean> {
    // Unscoped, by design: the machine proved who it is with a signature on the
    // link, and there is no person on a heartbeat to scope by.
    const found = await this.hosts.findOneByIdForMachine(hostId);
    if (found.isNone() || found.unwrap().isUnpaired) return false;

    // Presence first: it is the write every beat owes, and the one `online`
    // reads. The host row itself is not touched — a heartbeat is not a change
    // to the host (`product/versions/mvp/13-host-metadata.md`).
    await this.metadata.recordVitals(
      hostId,
      {
        connectedAt: report.connectedAt,
        roundTripMillis: report.roundTripMillis,
        loadAverage: report.loadAverage,
        memoryAvailableBytes: report.memoryAvailableBytes,
        diskFreeBytes: report.facts.diskFreeBytes,
      },
      at,
    );
    await this.metadata.recordInventory(
      hostId,
      inventoryFromFacts(report.facts, report.channel ?? null),
      at,
    );
    return true;
  }
}
