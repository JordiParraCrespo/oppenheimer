import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Host metadata, split by how often it changes and who reads it.
 *
 * `host` was one row doing four jobs: identity (owner, name, key), what the
 * machine is (`hostname`, `os`, `arch`, `runnerVersion`, `capabilities`),
 * whether it is there (`lastSeenAt`), and nothing about where it connects
 * from. The third job rewrote the whole ~1 KB row — key, name, the full jsonb
 * inventory — every 15 seconds per online host to move one timestamp, and
 * because the inventory carried free disk it could never tell "the machine
 * changed" from "a heartbeat arrived". That is the shape
 * `database-design.md` § Scale says not to build. Measured on Postgres 16
 * with 20,000 single-row heartbeats: the old row averaged 1,080 bytes and
 * cost 558 bytes of WAL per heartbeat; `host_presence` averages 90 bytes and
 * costs 242. Both stay HOT when each beat commits on its own (97% and 100%),
 * so the saving is width and WAL, and the inventory is no longer rewritten
 * at all.
 *
 * So metadata becomes four tables, each with one write rate and one reader
 * (`product/versions/mvp/13-host-metadata.md`):
 *
 * - `host_inventory` — **what the machine is.** One row per host, keyed by
 *   the host. Written only when the static facts change: the API hashes the
 *   canonical static facts and the upsert's `WHERE "factsHash" IS DISTINCT
 *   FROM` turns a repeat into a lock and no tuple. The fields the console
 *   shows or a rollout counts are columns; the full report stays in `facts`
 *   so a field a newer runner sends is kept before anything promotes it.
 *   Runner-sourced vocabularies (`virtualization`, `cloudProvider`,
 *   `serviceManager`, `channel`) carry no CHECK on purpose: a runner newer
 *   than the control plane may send a value this schema has never heard of,
 *   and a refused insert would lose the whole report. `platform` is the
 *   exception, because the shared schema already closes it.
 * - `host_presence` — **whether it is there, right now.** One narrow row per
 *   host that has ever connected, rewritten on every heartbeat with the last
 *   live numbers (load, memory, disk, round trip). Nothing a heartbeat
 *   rewrites is indexed, and `fillfactor = 70` leaves room on the page for
 *   the new version, so a heartbeat stays a HOT update: one small tuple, no
 *   index writes. `currentNetworkId` is indexed (for the retention below) but
 *   changes only on connect.
 * - `host_network` — **where it connects from.** One row per distinct public
 *   address a host has connected from, with the geography resolved at the
 *   time: first and last seen, so "optimus is on a network it has never used"
 *   is a unique-index probe. It is a dimension, not a log: bounded by the
 *   addresses a machine actually moves between, not by time. The address is
 *   what this process saw on the link, never what the runner claims; private
 *   and VPN addresses are deliberately not collected.
 * - `host_event` — **what changed, and when.** Append-only: paired, renamed,
 *   unpaired, facts changed (with the diff), network changed, runner updated
 *   or rolled back. It is the timeline a host's detail shows and the record
 *   the update story (09 §5) needs. It grows with changes, not heartbeats.
 *
 * Heartbeat **history** is deliberately not here. Keeping every 15-second
 * sample of every host in the transactional database is how an OLTP store
 * becomes a bad time-series store; presence keeps the latest values only,
 * and a history, if a screen ever needs one, is a metrics backend's job.
 *
 * Every table hangs off `host` with `ON DELETE CASCADE`: hosts are never
 * hard-deleted except when their owner's account is, and then nothing about
 * the machine should survive. None of them carries `ownerUserId`: they are
 * only ever read through a host already loaded under the caller's scope.
 *
 * `host` keeps its old columns in this migration (expand). The code switches
 * its reads and writes to these tables, and a later migration drops
 * `hostname`, `os`, `arch`, `runnerVersion`, `capabilities` and `lastSeenAt`
 * (contract). The backfill below runs in the boot transaction because `host`
 * is small today — one row per paired machine — and says so; on a large
 * deployment it would be a one-off command first.
 *
 * Access patterns and the index that serves each:
 *   Q1 a person's hosts with presence and inventory (Settings, sidebar)
 *        → IDX_host_owner, then PK_host_presence and PK_host_inventory
 *   Q2 one host with the same                            → the three PKs
 *   Q3 heartbeat: UPDATE host_presence WHERE hostId      → PK_host_presence (HOT)
 *   Q4 facts upsert, a no-op when the hash is unchanged  → PK_host_inventory
 *   Q5 connect: has this host used this address before?  → UQ_host_network_host_ip
 *   Q6 a host's timeline, newest first, keyset           → IDX_host_event_host_occurred
 *   Q7 retention: networks unseen for 90 days, not current
 *        → IDX_host_network_last_seen, IDX_host_presence_current_network
 *   Q8 retention: events older than 180 days            → IDX_host_event_occurred_brin
 *
 * Retention: `host_network` rows unseen for 90 days are deleted unless they
 * are a host's current network — an IP address is personal data, so the
 * history of where a laptop has been is kept only as long as the new-network
 * check needs it. `host_event` rows older than 180 days are deleted in
 * batches through the BRIN index. Both run from a scheduled job; the table is
 * a partitioning candidate only far past the volumes changes produce.
 */
export class AddHostInventoryAndPresence1789700000000 implements MigrationInterface {
  name = 'AddHostInventoryAndPresence1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "host_inventory" (
        "hostId"            uuid NOT NULL,
        "factsHash"         character varying(64) NOT NULL,
        "platform"          character varying(16) NOT NULL,
        "osName"            character varying(80),
        "osVersion"         character varying(40),
        "kernelVersion"     character varying(64),
        "arch"              character varying(16) NOT NULL,
        "hostname"          character varying(255) NOT NULL,
        "cpuModel"          character varying(128),
        "cpuCount"          smallint,
        "memoryTotalBytes"  bigint,
        "diskTotalBytes"    bigint,
        "virtualization"    character varying(24),
        "cloudProvider"     character varying(24),
        "timezone"          character varying(64),
        "bootedAt"          TIMESTAMP WITH TIME ZONE,
        "runnerVersion"     character varying(40) NOT NULL,
        "channel"           character varying(16),
        "serviceManager"    character varying(16),
        "tools"             jsonb NOT NULL DEFAULT '[]',
        "facts"             jsonb NOT NULL,
        "changedAt"         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdAt"         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_host_inventory" PRIMARY KEY ("hostId"),
        CONSTRAINT "CHK_host_inventory_facts_hash" CHECK ("factsHash" ~ '^[0-9a-f]{64}$'),
        CONSTRAINT "CHK_host_inventory_platform"
          CHECK ("platform" IN ('macos', 'debian', 'ubuntu', 'linux', 'unsupported')),
        CONSTRAINT "CHK_host_inventory_cpu_count" CHECK ("cpuCount" IS NULL OR "cpuCount" > 0),
        CONSTRAINT "CHK_host_inventory_memory"
          CHECK ("memoryTotalBytes" IS NULL OR "memoryTotalBytes" > 0),
        CONSTRAINT "CHK_host_inventory_disk"
          CHECK ("diskTotalBytes" IS NULL OR "diskTotalBytes" > 0),
        CONSTRAINT "CHK_host_inventory_tools_array" CHECK (jsonb_typeof("tools") = 'array'),
        CONSTRAINT "FK_host_inventory_host"
          FOREIGN KEY ("hostId") REFERENCES "host"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "host_network" (
        "id"            uuid NOT NULL DEFAULT gen_random_uuid(),
        "hostId"        uuid NOT NULL,
        "ip"            inet NOT NULL,
        "countryCode"   character(2),
        "region"        character varying(64),
        "city"          character varying(64),
        "asn"           integer,
        "asnOrg"        character varying(128),
        "firstSeenAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "lastSeenAt"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_host_network" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_host_network_host_ip" UNIQUE ("hostId", "ip"),
        CONSTRAINT "CHK_host_network_country" CHECK ("countryCode" ~ '^[A-Z]{2}$'),
        CONSTRAINT "CHK_host_network_asn" CHECK ("asn" IS NULL OR "asn" > 0),
        CONSTRAINT "CHK_host_network_seen_order" CHECK ("lastSeenAt" >= "firstSeenAt"),
        CONSTRAINT "FK_host_network_host"
          FOREIGN KEY ("hostId") REFERENCES "host"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    // Q7: the retention job's range scan. `lastSeenAt` moves only on connect,
    // so indexing it costs a reconnect, never a heartbeat.
    await queryRunner.query(
      `CREATE INDEX "IDX_host_network_last_seen" ON "host_network" ("lastSeenAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE "host_presence" (
        "hostId"                uuid NOT NULL,
        "currentNetworkId"      uuid,
        "connectedAt"           TIMESTAMP WITH TIME ZONE,
        "lastSeenAt"            TIMESTAMP WITH TIME ZONE NOT NULL,
        "roundTripMillis"       integer,
        "loadAverage"           numeric(7,2),
        "memoryAvailableBytes"  bigint,
        "diskFreeBytes"         bigint,
        "createdAt"             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_host_presence" PRIMARY KEY ("hostId"),
        CONSTRAINT "CHK_host_presence_round_trip"
          CHECK ("roundTripMillis" IS NULL OR "roundTripMillis" >= 0),
        CONSTRAINT "CHK_host_presence_load" CHECK ("loadAverage" IS NULL OR "loadAverage" >= 0),
        CONSTRAINT "CHK_host_presence_memory"
          CHECK ("memoryAvailableBytes" IS NULL OR "memoryAvailableBytes" >= 0),
        CONSTRAINT "CHK_host_presence_disk" CHECK ("diskFreeBytes" IS NULL OR "diskFreeBytes" >= 0),
        CONSTRAINT "FK_host_presence_host"
          FOREIGN KEY ("hostId") REFERENCES "host"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        -- A network row may be retired by retention while nothing points at
        -- it; if one ever is while current, the host keeps its presence and
        -- only loses the region until its next connect.
        CONSTRAINT "FK_host_presence_current_network"
          FOREIGN KEY ("currentNetworkId") REFERENCES "host_network"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION
      ) WITH (fillfactor = 70)
    `);
    // Q7 and the FK: the retention job skips a network some host is on now,
    // and deleting a network must not scan presence. Changes only on connect.
    await queryRunner.query(
      `CREATE INDEX "IDX_host_presence_current_network" ON "host_presence" ("currentNetworkId") WHERE "currentNetworkId" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "host_event" (
        "id"          bigint GENERATED ALWAYS AS IDENTITY,
        "hostId"      uuid NOT NULL,
        "kind"        character varying(32) NOT NULL,
        "payload"     jsonb NOT NULL DEFAULT '{}',
        "occurredAt"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_host_event" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_host_event_kind" CHECK ("kind" IN (
          'paired', 'renamed', 'unpaired', 'facts_changed', 'network_changed',
          'runner_updated', 'runner_rolled_back'
        )),
        CONSTRAINT "CHK_host_event_payload_object" CHECK (jsonb_typeof("payload") = 'object'),
        CONSTRAINT "FK_host_event_host"
          FOREIGN KEY ("hostId") REFERENCES "host"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    // Q6, and the FK's index: a host's timeline, newest first, keyset on
    // (occurredAt, id) — scanned backwards, so no DESC.
    await queryRunner.query(
      `CREATE INDEX "IDX_host_event_host_occurred" ON "host_event" ("hostId", "occurredAt", "id")`,
    );
    // Q8: rows arrive roughly in time order, so a BRIN serves the retention
    // delete for a few pages of index.
    await queryRunner.query(
      `CREATE INDEX "IDX_host_event_occurred_brin" ON "host_event" USING brin ("occurredAt")`,
    );

    // Backfill (expand). What `host` already knows moves over as it is, so the
    // switch-over reads the same values the old columns held. Small by
    // construction today; see the header.
    await queryRunner.query(`
      INSERT INTO "host_inventory" (
        "hostId", "factsHash", "platform", "osVersion", "arch", "hostname",
        "cpuCount", "runnerVersion", "tools", "facts", "changedAt"
      )
      SELECT
        h."id",
        encode(sha256(convert_to(h."capabilities"::text, 'UTF8')), 'hex'),
        h."capabilities"->>'platform',
        NULLIF(h."capabilities"->>'osVersion', ''),
        COALESCE(h."capabilities"->>'arch', h."arch", ''),
        COALESCE(h."capabilities"->>'hostname', h."hostname", ''),
        NULLIF((h."capabilities"->>'cpus'), '')::smallint,
        COALESCE(h."capabilities"->>'runnerVersion', h."runnerVersion", ''),
        CASE WHEN jsonb_typeof(h."capabilities"->'tools') = 'array'
             THEN h."capabilities"->'tools' ELSE '[]'::jsonb END,
        h."capabilities",
        h."updatedAt"
      FROM "host" h
      WHERE h."capabilities" IS NOT NULL
        AND h."capabilities"->>'platform' IN ('macos', 'debian', 'ubuntu', 'linux', 'unsupported')
      ON CONFLICT ("hostId") DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO "host_presence" ("hostId", "lastSeenAt", "diskFreeBytes")
      SELECT
        h."id",
        h."lastSeenAt",
        CASE WHEN jsonb_typeof(h."capabilities"->'diskFreeBytes') = 'number'
             THEN (h."capabilities"->>'diskFreeBytes')::bigint END
      FROM "host" h
      WHERE h."lastSeenAt" IS NOT NULL
      ON CONFLICT ("hostId") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_host_event_occurred_brin"`);
    await queryRunner.query(`DROP INDEX "IDX_host_event_host_occurred"`);
    await queryRunner.query(`DROP TABLE "host_event"`);
    await queryRunner.query(`DROP INDEX "IDX_host_presence_current_network"`);
    await queryRunner.query(`DROP TABLE "host_presence"`);
    await queryRunner.query(`DROP INDEX "IDX_host_network_last_seen"`);
    await queryRunner.query(`DROP TABLE "host_network"`);
    await queryRunner.query(`DROP TABLE "host_inventory"`);
  }
}
