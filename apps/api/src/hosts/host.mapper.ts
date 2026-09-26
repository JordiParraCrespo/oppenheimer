import { Injectable } from '@nestjs/common';
import type { DomainEvent, Mapper } from '@oppenheimer/backend-ddd';
import {
  type HostFactsDto,
  type HostPlatform,
  type HostToolDto,
  hostFactsSchema,
} from '@oppenheimer/shared';
import { HostOrmEntity } from './database/host.orm-entity';
import type { HostEventOrmEntity } from './database/host-event.orm-entity';
import type { HostInventoryOrmEntity } from './database/host-inventory.orm-entity';
import type { HostMetadata, TimelineCursor } from './database/host-metadata.repository.port';
import type { HostNetworkOrmEntity } from './database/host-network.orm-entity';
import type { HostPresenceOrmEntity } from './database/host-presence.orm-entity';
import { HostRegisteredDomainEvent } from './domain/events/host-registered.domain-event';
import { HostRenamedDomainEvent } from './domain/events/host-renamed.domain-event';
import { HostUnpairedDomainEvent } from './domain/events/host-unpaired.domain-event';
import { HostEntity, hostPlatformOf, type RegisterHostProps } from './domain/host.entity';
import { inventoryFromFacts } from './domain/host-inventory.policy';
import type {
  HostInventory,
  HostNetwork,
  HostTimelineEntry,
  HostTimelineKind,
  HostVitals,
  StoredHostInventory,
  StoredHostTimelineEntry,
} from './domain/host-metadata.types';
import { hostStatusOf } from './domain/host-status.policy';
import { HostResponseDto } from './dtos/host.response.dto';
import type {
  HostMachineResponseDto,
  HostNetworkResponseDto,
  HostTimelineEntryResponseDto,
  HostVitalsResponseDto,
} from './dtos/host-metadata.response.dto';

/** What a runner sends when it registers, before anything has been read out of it. */
export interface HostRegistration {
  /** The id the redemption statement recorded for this host. */
  id: string;
  ownerUserId: string;
  /** The name the token carried, or the one the runner detected. */
  name: string;
  publicKey: string;
  publicKeyFingerprint: string;
  /**
   * The machine's facts, already validated against `hostFactsSchema` — the same
   * shape the link's `hello` and `heartbeat` carry, so pairing and the link
   * describe one machine.
   */
  facts: HostFactsDto | undefined;
  pairingTokenId: string;
}

/** What a read knows about a host beyond its row. Absent reads as offline with nothing running. */
export interface HostResponseView {
  online?: boolean;
  runningSessions?: number;
  inventory?: StoredHostInventory | null;
  vitals?: HostVitals | null;
  network?: HostNetwork | null;
}

/** Maps the host aggregate between its domain, persistence and response shapes. */
@Injectable()
export class HostMapper implements Mapper<HostEntity, HostOrmEntity, HostResponseDto> {
  /**
   * Registration payload → the props the aggregate is created from.
   *
   * The four facts worth a column of their own are pulled out — what the machine
   * calls itself, its platform, its architecture and the version of the runner
   * reporting them — and the whole inventory is kept on `capabilities` as it
   * arrived, because what a session wants to know about a host grows and a jsonb
   * column grows with it. The probed tools stay in there rather than becoming a
   * detected-agents column: an agent *is* a probed tool, and deriving the list
   * by name costs a filter and keeps one source for "what is installed".
   */
  toRegisterProps(registration: HostRegistration): RegisterHostProps {
    const facts = registration.facts;
    return {
      id: registration.id,
      ownerUserId: registration.ownerUserId,
      name: registration.name,
      publicKey: registration.publicKey,
      publicKeyFingerprint: registration.publicKeyFingerprint,
      hostname: facts?.hostname ?? null,
      os: facts ? hostPlatformOf(facts) : null,
      arch: facts?.arch ?? null,
      runnerVersion: facts?.runnerVersion ?? null,
      capabilities: facts ? { ...facts } : null,
      pairingTokenId: registration.pairingTokenId,
    };
  }

  /**
   * What the machine is, as it paired, read off the facts the new aggregate
   * recorded: the inventory row starts at registration, so Settings describes
   * a host before its first link comes up. Narrowed once, through the same
   * schema registration validated; no channel yet — the heartbeat carries it.
   */
  toRegisterInventory(host: HostEntity): HostInventory | null {
    const facts = hostFactsSchema.safeParse(host.capabilities);
    return facts.success ? inventoryFromFacts(facts.data, null) : null;
  }

  toPersistence(entity: HostEntity): HostOrmEntity {
    const record = new HostOrmEntity();
    record.id = entity.id;
    record.ownerUserId = entity.ownerUserId;
    record.name = entity.name;
    record.hostname = entity.hostname;
    record.os = entity.os;
    record.arch = entity.arch;
    record.runnerVersion = entity.runnerVersion;
    record.capabilities = entity.capabilities;
    record.publicKey = entity.publicKey;
    record.publicKeyFingerprint = entity.publicKeyFingerprint;
    record.lastSeenAt = entity.lastSeenAt;
    record.unpairedAt = entity.unpairedAt;
    return record;
  }

  /**
   * ORM → domain. What the machine is and when it was last seen come from the
   * side tables when they are loaded (`metadata`), and from the row's own
   * columns only for a read that did not load them. Those columns are the
   * expand step's leftovers: the heartbeat no longer writes them, and a later
   * migration drops them (`product/versions/mvp/13-host-metadata.md`).
   */
  toDomain(record: HostOrmEntity, metadata?: HostMetadata): HostEntity {
    const inventory = metadata?.inventory ?? null;
    return HostEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        ownerUserId: record.ownerUserId,
        name: record.name,
        hostname: inventory ? inventory.hostname : record.hostname,
        os: inventory ? platformLabel(inventory) : record.os,
        arch: inventory ? inventory.arch : record.arch,
        runnerVersion: inventory ? inventory.runnerVersion : record.runnerVersion,
        capabilities: inventory ? { ...inventory.facts } : record.capabilities,
        publicKey: record.publicKey,
        publicKeyFingerprint: record.publicKeyFingerprint,
        lastSeenAt: metadata ? (metadata.vitals?.lastSeenAt ?? null) : record.lastSeenAt,
        unpairedAt: record.unpairedAt,
      },
    });
  }

  inventoryToDomain(row: HostInventoryOrmEntity): StoredHostInventory {
    return {
      factsHash: row.factsHash,
      platform: row.platform as HostPlatform,
      osName: row.osName,
      osVersion: row.osVersion,
      kernelVersion: row.kernelVersion,
      arch: row.arch,
      hostname: row.hostname,
      cpuModel: row.cpuModel,
      cpuCount: row.cpuCount,
      memoryTotalBytes: toNumber(row.memoryTotalBytes),
      diskTotalBytes: toNumber(row.diskTotalBytes),
      virtualization: row.virtualization,
      cloudProvider: row.cloudProvider,
      timezone: row.timezone,
      bootedAt: row.bootedAt,
      runnerVersion: row.runnerVersion,
      channel: row.channel,
      serviceManager: row.serviceManager,
      tools: (row.tools ?? []) as HostToolDto[],
      facts: row.facts ?? {},
      changedAt: row.changedAt,
    };
  }

  vitalsToDomain(row: HostPresenceOrmEntity): HostVitals {
    return {
      lastSeenAt: row.lastSeenAt,
      connectedAt: row.connectedAt,
      roundTripMillis: row.roundTripMillis,
      loadAverage: toNumber(row.loadAverage),
      memoryAvailableBytes: toNumber(row.memoryAvailableBytes),
      diskFreeBytes: toNumber(row.diskFreeBytes),
    };
  }

  networkToDomain(row: HostNetworkOrmEntity): HostNetwork {
    return {
      id: row.id,
      ip: row.ip,
      countryCode: row.countryCode,
      region: row.region,
      city: row.city,
      asn: row.asn,
      asnOrg: row.asnOrg,
      firstSeenAt: row.firstSeenAt,
      lastSeenAt: row.lastSeenAt,
    };
  }

  timelineToDomain(row: HostEventOrmEntity): StoredHostTimelineEntry {
    return {
      id: String(row.id),
      kind: row.kind as HostTimelineKind,
      payload: row.payload ?? {},
      occurredAt: row.occurredAt,
    };
  }

  /**
   * The timeline entries an aggregate's domain events stand for, written in the
   * same transaction as the change they describe — so the timeline is a
   * projection of what the aggregate did, and a redelivered outbox event can
   * never append it twice.
   */
  toTimelineEntries(events: readonly DomainEvent[]): HostTimelineEntry[] {
    return events.flatMap((event): HostTimelineEntry[] => {
      if (event instanceof HostRegisteredDomainEvent) {
        return [
          {
            kind: 'paired',
            payload: {
              name: event.name,
              hostname: event.hostname,
              os: event.os,
              fingerprint: event.publicKeyFingerprint,
            },
          },
        ];
      }
      if (event instanceof HostRenamedDomainEvent) {
        return [{ kind: 'renamed', payload: { from: event.from, to: event.to } }];
      }
      if (event instanceof HostUnpairedDomainEvent) {
        return [{ kind: 'unpaired', payload: {} }];
      }
      return [];
    });
  }

  /**
   * Domain → response.
   *
   * `online` is not a column and is never derived here: it is
   * `lastSeenAt > now() − 2 × heartbeat`, computed by the read query in the
   * database so the list cannot disagree with itself between rows. The running
   * session count belongs to the module that owns sessions. Both arrive as the
   * `view` for that reason, and `status` is read off the three.
   *
   * The public key itself stays on the server. What identifies a machine to a
   * person is its fingerprint, and that is what the console shows.
   */
  toResponse(entity: HostEntity, view: HostResponseView = {}): HostResponseDto {
    const online = view.online ?? false;
    const runningSessions = view.runningSessions ?? 0;
    const dto = new HostResponseDto();
    dto.id = entity.id;
    dto.ownerUserId = entity.ownerUserId;
    dto.name = entity.name;
    dto.hostname = entity.hostname;
    dto.os = entity.os;
    dto.arch = entity.arch;
    dto.runnerVersion = entity.runnerVersion;
    dto.capabilities = entity.capabilities;
    dto.publicKeyFingerprint = entity.publicKeyFingerprint;
    dto.online = online;
    dto.status = hostStatusOf({ unpaired: entity.isUnpaired, online, runningSessions });
    dto.runningSessionCount = runningSessions;
    dto.lastSeenAt = entity.lastSeenAt;
    dto.machine = view.inventory ? this.toMachineResponse(view.inventory) : null;
    dto.vitals = view.vitals ? this.toVitalsResponse(view.vitals) : null;
    dto.network = view.network ? this.toNetworkResponse(view.network) : null;
    dto.unpairedAt = entity.unpairedAt;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }

  toMachineResponse(inventory: StoredHostInventory): HostMachineResponseDto {
    return {
      osName: inventory.osName,
      kernelVersion: inventory.kernelVersion,
      cpuModel: inventory.cpuModel,
      cpuCount: inventory.cpuCount,
      memoryTotalBytes: inventory.memoryTotalBytes,
      diskTotalBytes: inventory.diskTotalBytes,
      virtualization: inventory.virtualization,
      cloudProvider: inventory.cloudProvider,
      timezone: inventory.timezone,
      bootedAt: inventory.bootedAt,
      channel: inventory.channel,
      serviceManager: inventory.serviceManager,
      changedAt: inventory.changedAt,
    };
  }

  toVitalsResponse(vitals: HostVitals): HostVitalsResponseDto {
    return {
      connectedAt: vitals.connectedAt,
      roundTripMillis: vitals.roundTripMillis,
      loadAverage: vitals.loadAverage,
      memoryAvailableBytes: vitals.memoryAvailableBytes,
      diskFreeBytes: vitals.diskFreeBytes,
    };
  }

  toNetworkResponse(network: HostNetwork): HostNetworkResponseDto {
    return {
      ip: network.ip,
      countryCode: network.countryCode,
      region: network.region,
      city: network.city,
      asn: network.asn,
      asnOrg: network.asnOrg,
      firstSeenAt: network.firstSeenAt,
      lastSeenAt: network.lastSeenAt,
    };
  }

  /** `next` on the wire: opaque, so the cursor's shape can change without a client noticing. */
  encodeTimelineCursor(cursor: TimelineCursor | null): string | null {
    if (!cursor) return null;
    return Buffer.from(`${cursor.occurredAt.toISOString()}|${cursor.id}`).toString('base64url');
  }

  /** A cursor this API minted, or null for anything else — a bad cursor is the first page. */
  decodeTimelineCursor(raw: string | undefined): TimelineCursor | null {
    if (!raw) return null;
    const [at, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
    const occurredAt = new Date(at ?? '');
    if (Number.isNaN(occurredAt.getTime()) || !/^\d{1,19}$/.test(id ?? '')) return null;
    return { occurredAt, id: id as string };
  }

  toTimelineResponse(entry: StoredHostTimelineEntry): HostTimelineEntryResponseDto {
    return {
      id: entry.id,
      kind: entry.kind,
      payload: entry.payload,
      occurredAt: entry.occurredAt,
    };
  }

  /**
   * The `name` of each entry in the inventory's `tools`, which is what the
   * runner probed, found or not; null when there is no inventory yet.
   */
  toProbedTools(capabilities: unknown): string[] | null {
    if (typeof capabilities !== 'object' || capabilities === null) return null;
    const { tools } = capabilities as { tools?: unknown };
    if (!Array.isArray(tools)) return null;
    return tools.flatMap((tool: unknown) => {
      const name =
        typeof tool === 'object' && tool !== null ? Reflect.get(tool, 'name') : undefined;
      return typeof name === 'string' ? [name] : [];
    });
  }
}

/** `bigint` and `numeric` arrive from `pg` as strings; every byte count here is below 2^53. */
function toNumber(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The platform column: the family the runner installs a service for, plus the
 * release when it could determine one — `macos 15.2` reads better on a host row
 * than `macos` alone. The same rule `hostPlatformOf` applies to fresh facts.
 */
function platformLabel(inventory: StoredHostInventory): string {
  return inventory.osVersion ? `${inventory.platform} ${inventory.osVersion}` : inventory.platform;
}
