import { Inject, Injectable } from '@nestjs/common';
import type { HostRepositoryPort } from '../database/host.repository.port';
import type { HostMetadataRepositoryPort } from '../database/host-metadata.repository.port';
import { HostNetworkChangedDomainEvent } from '../domain/events/host-network-changed.domain-event';
import { inventoryFromFacts } from '../domain/host-inventory.policy';
import type { HostNetwork } from '../domain/host-metadata.types';
import { networkMoveIsNotable } from '../domain/host-network.policy';
import { HOST_METADATA_REPOSITORY, HOST_REPOSITORY, IP_GEOLOCATION } from '../hosts.di-tokens';
import type { IpGeolocationPort } from '../infrastructure/ip-geolocation.port';
import type { HostPresencePort, PresenceReport } from './host-presence.port';

@Injectable()
export class HostPresenceResolver implements HostPresencePort {
  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
    @Inject(HOST_METADATA_REPOSITORY)
    private readonly metadata: HostMetadataRepositoryPort,
    @Inject(IP_GEOLOCATION)
    private readonly geolocation: IpGeolocationPort,
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

  async connectedFrom(hostId: string, address: string, at: Date = new Date()): Promise<void> {
    const found = await this.hosts.findOneByIdForMachine(hostId);
    if (found.isNone() || found.unwrap().isUnpaired) return;
    const host = found.unwrap();
    const place = await this.geolocation.lookup(address);
    await this.metadata.recordNetwork(hostId, { ip: address, ...place }, at, (from, to) =>
      networkMoveIsNotable(from, to)
        ? [
            new HostNetworkChangedDomainEvent({
              aggregateId: hostId,
              ownerUserId: host.ownerUserId,
              hostName: host.name,
              from: summary(from),
              to: summary(to),
              reason: 'A host connected from another country or network operator',
            }),
          ]
        : [],
    );
  }
}

function summary(network: HostNetwork) {
  return {
    ip: network.ip,
    countryCode: network.countryCode,
    city: network.city,
    asn: network.asn,
    asnOrg: network.asnOrg,
  };
}
