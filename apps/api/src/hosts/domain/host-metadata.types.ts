import type { HostPlatform, HostToolDto } from '@oppenheimer/shared';

/**
 * What a host *is*, as `host_inventory` holds it: the static half of the
 * runner's facts, promoted to named fields, plus the report as it arrived.
 * Written only when `factsHash` changes (`host-inventory.policy.ts`).
 */
export interface HostInventory {
  factsHash: string;
  platform: HostPlatform;
  osName: string | null;
  osVersion: string | null;
  kernelVersion: string | null;
  arch: string;
  hostname: string;
  cpuModel: string | null;
  cpuCount: number | null;
  memoryTotalBytes: number | null;
  diskTotalBytes: number | null;
  virtualization: string | null;
  cloudProvider: string | null;
  timezone: string | null;
  bootedAt: Date | null;
  runnerVersion: string;
  /** From the heartbeat, not the facts; null until one has arrived. */
  channel: string | null;
  serviceManager: string | null;
  tools: HostToolDto[];
  /** The static facts as reported, for the fields nothing has promoted yet. */
  facts: Record<string, unknown>;
}

/** When the inventory last changed, beside what it is. */
export interface StoredHostInventory extends HostInventory {
  changedAt: Date;
}

/** Whether a host is there, and its last live numbers: `host_presence`. */
export interface HostVitals {
  lastSeenAt: Date;
  connectedAt: Date | null;
  roundTripMillis: number | null;
  loadAverage: number | null;
  memoryAvailableBytes: number | null;
  diskFreeBytes: number | null;
}

/** A public address a host connected from, and where it is: `host_network`. */
export interface HostNetwork {
  id: string;
  ip: string;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  asn: number | null;
  asnOrg: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

/** One entry of a host's timeline: `host_event`. */
export const HOST_TIMELINE_KINDS = [
  'paired',
  'renamed',
  'unpaired',
  'facts_changed',
  'network_changed',
  'runner_updated',
  'runner_rolled_back',
] as const;

export type HostTimelineKind = (typeof HOST_TIMELINE_KINDS)[number];

export interface HostTimelineEntry {
  kind: HostTimelineKind;
  payload: Record<string, unknown>;
}

export interface StoredHostTimelineEntry extends HostTimelineEntry {
  /** `bigint` identity, as the string `pg` returns. */
  id: string;
  occurredAt: Date;
}
