import type { DomainEvent } from '@oppenheimer/backend-ddd';
import type {
  HostInventory,
  HostNetwork,
  HostTimelineEntry,
  HostVitals,
  StoredHostInventory,
  StoredHostTimelineEntry,
} from '../domain/host-metadata.types';

/** What the side tables hold for one host, read together. */
export interface HostMetadata {
  inventory: StoredHostInventory | null;
  vitals: HostVitals | null;
  network: HostNetwork | null;
  /** `lastSeenAt` inside the online window, judged by the database's clock. */
  online: boolean;
}

/** What a hello or a heartbeat reports live. Absent means "not reported this time". */
export interface VitalsReport {
  connectedAt?: Date;
  roundTripMillis?: number | null;
  loadAverage?: number | null;
  memoryAvailableBytes?: number | null;
  diskFreeBytes?: number | null;
}

/** A public address as the API saw it, with what the IP database says about it. */
export interface NetworkObservation {
  ip: string;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  asn: number | null;
  asnOrg: string | null;
}

export interface RecordedNetwork {
  network: HostNetwork;
  /** The network the host was on before, when this connect moved it; null otherwise. */
  movedFrom: HostNetwork | null;
}

export interface TimelineCursor {
  occurredAt: Date;
  id: string;
}

export interface TimelinePage {
  entries: StoredHostTimelineEntry[];
  /** Where the next (older) page starts, or null at the end. */
  next: TimelineCursor | null;
}

/**
 * Port for a host's metadata: `host_inventory`, `host_presence`, `host_network`
 * and `host_event` (`product/versions/mvp/13-host-metadata.md`).
 *
 * None of these reads takes an access scope. Every caller already holds a host
 * it loaded under one — a person's list, a machine proving itself on the link —
 * and passes its id, which is the whole authorization.
 */
export interface HostMetadataRepositoryPort {
  /** Inventory, vitals, network and presence for each host; three primary-key reads in all. */
  findForHosts(hostIds: readonly string[]): Promise<Map<string, HostMetadata>>;
  /** One narrow upsert per heartbeat. Values not reported keep what is on file. */
  recordVitals(hostId: string, report: VitalsReport, at: Date): Promise<void>;
  /**
   * Write the inventory only when it changed — the hash, or a newly reported
   * channel — and append what changed to the timeline in the same transaction.
   * Returns the entries appended; empty on the common, unchanged path.
   */
  recordInventory(hostId: string, inventory: HostInventory, at: Date): Promise<HostTimelineEntry[]>;
  /**
   * Record the address a link came from, make it the host's current network,
   * and append `network_changed` when that moved the host. `eventsFor` names
   * the domain events a move owes — the new-network notice — and they are
   * staged on the outbox in the same transaction, so a move and its email
   * commit together or not at all.
   */
  recordNetwork(
    hostId: string,
    observation: NetworkObservation,
    at: Date,
    eventsFor?: (movedFrom: HostNetwork, network: HostNetwork) => DomainEvent[],
  ): Promise<RecordedNetwork>;
  /** A host's timeline, newest first, keyset-paginated. */
  findTimeline(hostId: string, before: TimelineCursor | null, limit: number): Promise<TimelinePage>;
  /** Retention: batches of networks unseen since `cutoff` and not current, events older than theirs. */
  deleteNetworksUnseenSince(cutoff: Date, batch: number): Promise<number>;
  deleteTimelineBefore(cutoff: Date, batch: number): Promise<number>;
}
