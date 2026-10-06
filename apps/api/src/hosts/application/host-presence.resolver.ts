import { Inject, Injectable } from '@nestjs/common';
import type { CredentialOwnerPort } from '../../auth/application/credential-owner.port';
import { CREDENTIAL_OWNER } from '../../auth/auth.di-tokens';
import type { WorkspaceEventsPort } from '../../workspace-events/application/workspace-events.port';
import { WORKSPACE_EVENTS } from '../../workspace-events/workspace-events.di-tokens';
import {
  HOST_ONLINE_WINDOW_SECONDS,
  type HostRepositoryPort,
} from '../database/host.repository.port';
import type { HostMetadataRepositoryPort } from '../database/host-metadata.repository.port';
import { HostNetworkChangedDomainEvent } from '../domain/events/host-network-changed.domain-event';
import { inventoryFromFacts } from '../domain/host-inventory.policy';
import type { HostInventory, HostNetwork } from '../domain/host-metadata.types';
import { networkMoveIsNotable } from '../domain/host-network.policy';
import { HOST_METADATA_REPOSITORY, HOST_REPOSITORY, IP_GEOLOCATION } from '../hosts.di-tokens';
import type { IpGeolocationPort } from '../infrastructure/ip-geolocation.port';
import type { HostPresencePort, PresenceOutcome, PresenceReport } from './host-presence.port';

/**
 * How many hosts' last recorded inventory one process remembers. A process
 * holds at most its own links, so this is a ceiling for a leak rather than a
 * working-set size; past it the oldest entry is forgotten and costs one read.
 */
const INVENTORY_MEMO_MAX_HOSTS = 10_000;

/**
 * How long a heartbeat trusts the last "the owner may act". A ban reaches an
 * open link within this, plus a beat; the attach socket re-checks on the same
 * minute.
 */
export const OWNER_RECHECK_MS = 60_000;

/**
 * How long after a link closes its owner's console is told to look again:
 * just past the window `online` is derived from, so the read finds the host
 * offline unless it has come back.
 */
export const OFFLINE_ANNOUNCE_DELAY_MS = (HOST_ONLINE_WINDOW_SECONDS + 1) * 1000;

/** What this process last recorded as a host's inventory: the two things `unchanged` compares. */
interface RecordedInventory {
  factsHash: string;
  channel: string | null;
}

@Injectable()
export class HostPresenceResolver implements HostPresencePort {
  /**
   * The inventory each host's last beat recorded **through this process**, so
   * the common heartbeat — the same facts as fifteen seconds ago — costs no
   * read at all. The repository's locked re-check stays the source of truth: a
   * memo that disagrees costs one read, never a wrong write. A hello always
   * reads, because the link may have been on another replica since this one
   * last saw it, and that replica may have written something else.
   */
  private readonly recordedInventory = new Map<string, RecordedInventory>();

  /** Each host's owner, and when this process last found they may act. */
  private readonly ownerChecks = new Map<string, { ownerUserId: string; checkedAt: number }>();

  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
    @Inject(HOST_METADATA_REPOSITORY)
    private readonly metadata: HostMetadataRepositoryPort,
    @Inject(IP_GEOLOCATION)
    private readonly geolocation: IpGeolocationPort,
    @Inject(CREDENTIAL_OWNER)
    private readonly owners: CredentialOwnerPort,
    @Inject(WORKSPACE_EVENTS)
    private readonly events: WorkspaceEventsPort,
  ) {}

  async observe(
    hostId: string,
    report: PresenceReport,
    at: Date = new Date(),
  ): Promise<PresenceOutcome> {
    const hello = report.connectedAt !== undefined;
    const standing = await this.ownerStanding(hostId, at, hello);
    if (standing !== 'recorded') {
      this.recordedInventory.delete(hostId);
      return standing;
    }
    // Presence first: it is the write every beat owes, and the one `online`
    // reads. The statement is also the pairing check, so an unpaired host is
    // answered without a separate read.
    const paired = await this.metadata.recordVitalsIfPaired(
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
    if (!paired) {
      this.recordedInventory.delete(hostId);
      this.ownerChecks.delete(hostId);
      return 'unpaired';
    }

    // A hello is a link opening, which is a host coming online; a beat on a
    // link that was already up changes nothing the console shows.
    if (hello) this.announce(hostId);

    const inventory = inventoryFromFacts(report.facts, report.channel ?? null);
    const recorded = this.recordedInventory.get(hostId);
    if (!hello && recorded && sameInventory(recorded, inventory)) return 'recorded';

    await this.metadata.recordInventory(hostId, inventory, at);
    this.rememberInventory(hostId, {
      factsHash: inventory.factsHash,
      // A beat that reports no channel keeps the one on file, as the write does.
      channel: inventory.channel ?? recorded?.channel ?? null,
    });
    return 'recorded';
  }

  /**
   * The handshake refuses a banned or deactivated owner's host; this is what
   * closes a link that was already open when the ban landed, on whichever
   * replica holds it. Asked on every hello and at most once per
   * `OWNER_RECHECK_MS` on heartbeats, so the common beat stays the one
   * statement it is; the owner id is remembered, because a host never changes
   * owner.
   */
  private async ownerStanding(hostId: string, at: Date, hello: boolean): Promise<PresenceOutcome> {
    const memo = this.ownerChecks.get(hostId);
    if (!hello && memo && at.getTime() - memo.checkedAt < OWNER_RECHECK_MS) return 'recorded';
    let ownerUserId = memo?.ownerUserId;
    if (!ownerUserId) {
      const found = await this.hosts.findOneByIdForMachine(hostId);
      if (found.isNone() || found.unwrap().isUnpaired) return 'unpaired';
      ownerUserId = found.unwrap().ownerUserId;
    }
    if (!(await this.owners.findActiveOwner(ownerUserId))) {
      this.ownerChecks.delete(hostId);
      return 'owner_refused';
    }
    this.ownerChecks.delete(hostId);
    this.ownerChecks.set(hostId, { ownerUserId, checkedAt: at.getTime() });
    if (this.ownerChecks.size > INVENTORY_MEMO_MAX_HOSTS) {
      const oldest = this.ownerChecks.keys().next().value;
      if (oldest !== undefined) this.ownerChecks.delete(oldest);
    }
    return 'recorded';
  }

  disconnected(hostId: string): void {
    setTimeout(() => {
      void this.ownerOf(hostId)
        .then((ownerUserId) => {
          if (ownerUserId) this.publish(ownerUserId, hostId);
        })
        .catch(() => undefined);
    }, OFFLINE_ANNOUNCE_DELAY_MS).unref();
  }

  /** Tell the owner's console the host's presence moved, once the owner is known. */
  private announce(hostId: string): void {
    const ownerUserId = this.ownerChecks.get(hostId)?.ownerUserId;
    if (ownerUserId) this.publish(ownerUserId, hostId);
  }

  private publish(ownerUserId: string, hostId: string): void {
    this.events.publish({ userId: ownerUserId }, { type: 'host.changed', id: hostId });
  }

  private async ownerOf(hostId: string): Promise<string | null> {
    const memo = this.ownerChecks.get(hostId)?.ownerUserId;
    if (memo) return memo;
    const found = await this.hosts.findOneByIdForMachine(hostId);
    return found.isSome() ? found.unwrap().ownerUserId : null;
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

  private rememberInventory(hostId: string, recorded: RecordedInventory): void {
    // Re-inserted so the map's order is least recently recorded first.
    this.recordedInventory.delete(hostId);
    this.recordedInventory.set(hostId, recorded);
    if (this.recordedInventory.size > INVENTORY_MEMO_MAX_HOSTS) {
      const oldest = this.recordedInventory.keys().next().value;
      if (oldest !== undefined) this.recordedInventory.delete(oldest);
    }
  }
}

/** The repository's own `unchanged`, against what this process last recorded. */
function sameInventory(recorded: RecordedInventory, inventory: HostInventory): boolean {
  return (
    recorded.factsHash === inventory.factsHash &&
    (inventory.channel === null || inventory.channel === recorded.channel)
  );
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
