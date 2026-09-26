import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { inventoryChanges } from '../domain/host-inventory.policy';
import type {
  HostInventory,
  HostNetwork,
  HostTimelineEntry,
  StoredHostInventory,
} from '../domain/host-metadata.types';
import { HostMapper } from '../host.mapper';
import { HOST_ONLINE_WINDOW_SECONDS } from './host.repository.port';
import type { HostEventOrmEntity } from './host-event.orm-entity';
import type { HostInventoryOrmEntity } from './host-inventory.orm-entity';
import type {
  HostMetadata,
  HostMetadataRepositoryPort,
  NetworkObservation,
  RecordedNetwork,
  TimelineCursor,
  TimelinePage,
  VitalsReport,
} from './host-metadata.repository.port';
import type { HostNetworkOrmEntity } from './host-network.orm-entity';
import type { HostPresenceOrmEntity } from './host-presence.orm-entity';

type PresenceRow = HostPresenceOrmEntity & { online: boolean };

/**
 * The four side tables, in SQL written out: every statement here is one the
 * migration's header names as an access pattern (Q1–Q8 in
 * `1789700000000-AddHostInventoryAndPresence.ts`), and a conditional upsert
 * or a keyset page reads better as the statement it is than as a builder.
 */
@Injectable()
export class HostMetadataRepository implements HostMetadataRepositoryPort {
  constructor(
    private readonly dataSource: DataSource,
    private readonly mapper: HostMapper,
  ) {}

  async findForHosts(hostIds: readonly string[]): Promise<Map<string, HostMetadata>> {
    const found = new Map<string, HostMetadata>();
    if (hostIds.length === 0) return found;
    const ids = [...hostIds];
    const [inventories, presences] = await Promise.all([
      this.dataSource.query(`SELECT * FROM "host_inventory" WHERE "hostId" = ANY($1)`, [
        ids,
      ]) as Promise<HostInventoryOrmEntity[]>,
      // `online` is judged here, by the database's clock, beside the row it
      // describes: one response, one clock.
      this.dataSource.query(
        `SELECT *, "lastSeenAt" > now() - ($2 * interval '1 second') AS "online"
           FROM "host_presence" WHERE "hostId" = ANY($1)`,
        [ids, HOST_ONLINE_WINDOW_SECONDS],
      ) as Promise<PresenceRow[]>,
    ]);
    const networkIds = presences.flatMap((row) =>
      row.currentNetworkId ? [row.currentNetworkId] : [],
    );
    const networks: HostNetworkOrmEntity[] = networkIds.length
      ? await this.dataSource.query(`SELECT * FROM "host_network" WHERE "id" = ANY($1)`, [
          networkIds,
        ])
      : [];
    const networkById = new Map(networks.map((row) => [row.id, this.mapper.networkToDomain(row)]));
    const inventoryByHost = new Map(
      inventories.map((row) => [row.hostId, this.mapper.inventoryToDomain(row)]),
    );
    const presenceByHost = new Map(presences.map((row) => [row.hostId, row]));
    for (const hostId of ids) {
      const presence = presenceByHost.get(hostId);
      found.set(hostId, {
        inventory: inventoryByHost.get(hostId) ?? null,
        vitals: presence ? this.mapper.vitalsToDomain(presence) : null,
        network: presence?.currentNetworkId
          ? (networkById.get(presence.currentNetworkId) ?? null)
          : null,
        online: presence?.online === true,
      });
    }
    return found;
  }

  /**
   * Q3. One row, nothing it writes indexed, so a HOT update. A value not
   * reported this time keeps the one on file, so a hello that carries no load
   * does not blank the last heartbeat's.
   */
  async recordVitals(hostId: string, report: VitalsReport, at: Date): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO "host_presence" AS p
         ("hostId", "lastSeenAt", "connectedAt", "roundTripMillis", "loadAverage",
          "memoryAvailableBytes", "diskFreeBytes", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $2)
       ON CONFLICT ("hostId") DO UPDATE SET
         "lastSeenAt" = EXCLUDED."lastSeenAt",
         "connectedAt" = COALESCE(EXCLUDED."connectedAt", p."connectedAt"),
         "roundTripMillis" = COALESCE(EXCLUDED."roundTripMillis", p."roundTripMillis"),
         "loadAverage" = COALESCE(EXCLUDED."loadAverage", p."loadAverage"),
         "memoryAvailableBytes" = COALESCE(EXCLUDED."memoryAvailableBytes", p."memoryAvailableBytes"),
         "diskFreeBytes" = COALESCE(EXCLUDED."diskFreeBytes", p."diskFreeBytes"),
         "updatedAt" = EXCLUDED."updatedAt"`,
      [
        hostId,
        at,
        report.connectedAt ?? null,
        report.roundTripMillis ?? null,
        report.loadAverage ?? null,
        report.memoryAvailableBytes ?? null,
        report.diskFreeBytes ?? null,
      ],
    );
  }

  /**
   * Q4. The common path is one primary-key read that finds the same hash and
   * writes nothing. Only a real change takes the row lock, re-reads under it
   * (a concurrent hello and heartbeat must not both append the same diff),
   * writes the row and appends what changed.
   */
  async recordInventory(
    hostId: string,
    inventory: HostInventory,
    at: Date,
  ): Promise<HostTimelineEntry[]> {
    const [current] = (await this.dataSource.query(
      `SELECT "factsHash", "channel" FROM "host_inventory" WHERE "hostId" = $1`,
      [hostId],
    )) as Pick<HostInventoryOrmEntity, 'factsHash' | 'channel'>[];
    if (current && unchanged(current, inventory)) return [];

    return this.dataSource.transaction(async (manager) => {
      const [locked] = (await manager.query(
        `SELECT * FROM "host_inventory" WHERE "hostId" = $1 FOR UPDATE`,
        [hostId],
      )) as HostInventoryOrmEntity[];
      if (locked && unchanged(locked, inventory)) return [];
      const before: StoredHostInventory | null = locked
        ? this.mapper.inventoryToDomain(locked)
        : null;
      const after: HostInventory = {
        ...inventory,
        channel: inventory.channel ?? before?.channel ?? null,
      };
      await manager.query(
        `INSERT INTO "host_inventory" (
           "hostId", "factsHash", "platform", "osName", "osVersion", "kernelVersion", "arch",
           "hostname", "cpuModel", "cpuCount", "memoryTotalBytes", "diskTotalBytes",
           "virtualization", "cloudProvider", "timezone", "bootedAt", "runnerVersion",
           "channel", "serviceManager", "tools", "facts", "changedAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                 $18, $19, $20, $21, $22, $22)
         ON CONFLICT ("hostId") DO UPDATE SET
           "factsHash" = EXCLUDED."factsHash", "platform" = EXCLUDED."platform",
           "osName" = EXCLUDED."osName", "osVersion" = EXCLUDED."osVersion",
           "kernelVersion" = EXCLUDED."kernelVersion", "arch" = EXCLUDED."arch",
           "hostname" = EXCLUDED."hostname", "cpuModel" = EXCLUDED."cpuModel",
           "cpuCount" = EXCLUDED."cpuCount", "memoryTotalBytes" = EXCLUDED."memoryTotalBytes",
           "diskTotalBytes" = EXCLUDED."diskTotalBytes",
           "virtualization" = EXCLUDED."virtualization",
           "cloudProvider" = EXCLUDED."cloudProvider", "timezone" = EXCLUDED."timezone",
           "bootedAt" = EXCLUDED."bootedAt", "runnerVersion" = EXCLUDED."runnerVersion",
           "channel" = EXCLUDED."channel", "serviceManager" = EXCLUDED."serviceManager",
           "tools" = EXCLUDED."tools", "facts" = EXCLUDED."facts",
           "changedAt" = EXCLUDED."changedAt", "updatedAt" = EXCLUDED."updatedAt"`,
        [
          hostId,
          after.factsHash,
          after.platform,
          after.osName,
          after.osVersion,
          after.kernelVersion,
          after.arch,
          after.hostname,
          after.cpuModel,
          after.cpuCount,
          after.memoryTotalBytes,
          after.diskTotalBytes,
          after.virtualization,
          after.cloudProvider,
          after.timezone,
          after.bootedAt,
          after.runnerVersion,
          after.channel,
          after.serviceManager,
          JSON.stringify(after.tools),
          JSON.stringify(after.facts),
          at,
        ],
      );
      const entries = inventoryChanges(before, after);
      await this.insertTimeline(manager, hostId, entries, at);
      return entries;
    });
  }

  /**
   * Q5. The address becomes (or stays) one of the host's networks and its
   * current one, and a move is on the timeline — all in one transaction, under
   * the presence row's lock so two links racing on a reconnect agree on what
   * "before" was.
   */
  async recordNetwork(
    hostId: string,
    observation: NetworkObservation,
    at: Date,
  ): Promise<RecordedNetwork> {
    return this.dataSource.transaction(async (manager) => {
      const [presence] = (await manager.query(
        `SELECT "currentNetworkId" FROM "host_presence" WHERE "hostId" = $1 FOR UPDATE`,
        [hostId],
      )) as Pick<HostPresenceOrmEntity, 'currentNetworkId'>[];
      const [row] = (await manager.query(
        `INSERT INTO "host_network" AS n
           ("hostId", "ip", "countryCode", "region", "city", "asn", "asnOrg",
            "firstSeenAt", "lastSeenAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $8)
         ON CONFLICT ("hostId", "ip") DO UPDATE SET
           "lastSeenAt" = EXCLUDED."lastSeenAt",
           "countryCode" = COALESCE(EXCLUDED."countryCode", n."countryCode"),
           "region" = COALESCE(EXCLUDED."region", n."region"),
           "city" = COALESCE(EXCLUDED."city", n."city"),
           "asn" = COALESCE(EXCLUDED."asn", n."asn"),
           "asnOrg" = COALESCE(EXCLUDED."asnOrg", n."asnOrg"),
           "updatedAt" = EXCLUDED."updatedAt"
         RETURNING *`,
        [
          hostId,
          observation.ip,
          observation.countryCode,
          observation.region,
          observation.city,
          observation.asn,
          observation.asnOrg,
          at,
        ],
      )) as HostNetworkOrmEntity[];
      const network = this.mapper.networkToDomain(row);

      const previousId = presence?.currentNetworkId ?? null;
      let movedFrom: HostNetwork | null = null;
      if (previousId && previousId !== network.id) {
        const [previous] = (await manager.query(`SELECT * FROM "host_network" WHERE "id" = $1`, [
          previousId,
        ])) as HostNetworkOrmEntity[];
        movedFrom = previous ? this.mapper.networkToDomain(previous) : null;
      }
      if (previousId !== network.id) {
        await manager.query(
          `UPDATE "host_presence" SET "currentNetworkId" = $2 WHERE "hostId" = $1`,
          [hostId, network.id],
        );
      }
      if (movedFrom) {
        await this.insertTimeline(
          manager,
          hostId,
          [
            {
              kind: 'network_changed',
              payload: { from: networkSummary(movedFrom), to: networkSummary(network) },
            },
          ],
          at,
        );
      }
      return { network, movedFrom };
    });
  }

  /** Q6. Newest first, keyset on (occurredAt, id), one row over the page to know there is more. */
  async findTimeline(
    hostId: string,
    before: TimelineCursor | null,
    limit: number,
  ): Promise<TimelinePage> {
    const rows = (await this.dataSource.query(
      before
        ? `SELECT * FROM "host_event" WHERE "hostId" = $1 AND ("occurredAt", "id") < ($3, $4)
             ORDER BY "occurredAt" DESC, "id" DESC LIMIT $2`
        : `SELECT * FROM "host_event" WHERE "hostId" = $1
             ORDER BY "occurredAt" DESC, "id" DESC LIMIT $2`,
      before ? [hostId, limit + 1, before.occurredAt, before.id] : [hostId, limit + 1],
    )) as HostEventOrmEntity[];
    const page = rows.slice(0, limit).map((row) => this.mapper.timelineToDomain(row));
    const last = page[page.length - 1];
    return {
      entries: page,
      next: rows.length > limit && last ? { occurredAt: last.occurredAt, id: last.id } : null,
    };
  }

  /** Q7. A batch through the index, never a network some host is on now. */
  async deleteNetworksUnseenSince(cutoff: Date, batch: number): Promise<number> {
    const [, count] = (await this.dataSource.query(
      `DELETE FROM "host_network" WHERE ctid = ANY (ARRAY(
         SELECT n.ctid FROM "host_network" n
          WHERE n."lastSeenAt" < $1
            AND NOT EXISTS (SELECT 1 FROM "host_presence" p WHERE p."currentNetworkId" = n."id")
          LIMIT $2))`,
      [cutoff, batch],
    )) as [unknown, number];
    return count;
  }

  /** Q8. A batch through the BRIN. */
  async deleteTimelineBefore(cutoff: Date, batch: number): Promise<number> {
    const [, count] = (await this.dataSource.query(
      `DELETE FROM "host_event" WHERE ctid = ANY (ARRAY(
         SELECT ctid FROM "host_event" WHERE "occurredAt" < $1 LIMIT $2))`,
      [cutoff, batch],
    )) as [unknown, number];
    return count;
  }

  /**
   * Append timeline entries inside a transaction someone else owns — the
   * host's own save, so a rename and its entry commit together.
   */
  async insertTimeline(
    manager: EntityManager,
    hostId: string,
    entries: readonly HostTimelineEntry[],
    at: Date,
  ): Promise<void> {
    for (const entry of entries) {
      await manager.query(
        `INSERT INTO "host_event" ("hostId", "kind", "payload", "occurredAt") VALUES ($1, $2, $3, $4)`,
        [hostId, entry.kind, JSON.stringify(entry.payload), at],
      );
    }
  }

  /** The unpaired host's current network stops being current, so retention can reach it. */
  async clearCurrentNetwork(manager: EntityManager, hostId: string): Promise<void> {
    await manager.query(
      `UPDATE "host_presence" SET "currentNetworkId" = NULL WHERE "hostId" = $1 AND "currentNetworkId" IS NOT NULL`,
      [hostId],
    );
  }
}

function unchanged(
  row: Pick<HostInventoryOrmEntity, 'factsHash' | 'channel'>,
  inventory: HostInventory,
): boolean {
  return (
    row.factsHash === inventory.factsHash &&
    (inventory.channel === null || inventory.channel === row.channel)
  );
}

/** What the timeline and the notice say about a network: never its id. */
function networkSummary(network: HostNetwork): Record<string, unknown> {
  return {
    ip: network.ip,
    countryCode: network.countryCode,
    region: network.region,
    city: network.city,
    asn: network.asn,
    asnOrg: network.asnOrg,
  };
}
