import type { SchemaSlice } from './schema-slice';

/** `host`, `host_event`, `host_inventory`, `host_network`, `host_pairing_token`, `host_presence`. See each table's ORM entity under `src/hosts/` for why it is shaped this way. */
export const hosts: SchemaSlice = {
  tables: {
    host: [
      `CREATE TABLE host (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "ownerUserId" uuid NOT NULL,
        name character varying(80) NOT NULL,
        hostname character varying(255),
        os character varying(40),
        arch character varying(40),
        "runnerVersion" character varying(40),
        capabilities jsonb,
        "publicKey" text NOT NULL,
        "publicKeyFingerprint" character varying(64) NOT NULL,
        "lastSeenAt" timestamp with time zone,
        "unpairedAt" timestamp with time zone,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
      )`,
      `ALTER TABLE host ADD CONSTRAINT "PK_host" PRIMARY KEY (id)`,
      `ALTER TABLE host ADD CONSTRAINT "UQ_host_public_key_fingerprint" UNIQUE ("publicKeyFingerprint")`,
      `CREATE INDEX "IDX_host_owner" ON host USING btree ("ownerUserId")`,
    ],
    host_event: [
      `CREATE TABLE host_event (
        id bigint NOT NULL,
        "hostId" uuid NOT NULL,
        kind character varying(32) NOT NULL,
        payload jsonb DEFAULT '{}'::jsonb NOT NULL,
        "occurredAt" timestamp with time zone DEFAULT now() NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "CHK_host_event_kind" CHECK (kind IN ('paired', 'renamed', 'unpaired', 'facts_changed', 'network_changed', 'runner_updated', 'runner_rolled_back')),
        CONSTRAINT "CHK_host_event_payload_object" CHECK ((jsonb_typeof(payload) = 'object'::text))
      )`,
      `ALTER TABLE host_event ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
        SEQUENCE NAME host_event_id_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
      )`,
      `ALTER TABLE host_event ADD CONSTRAINT "PK_host_event" PRIMARY KEY (id)`,
      `CREATE INDEX "IDX_host_event_host_occurred" ON host_event USING btree ("hostId", "occurredAt", id)`,
      `CREATE INDEX "IDX_host_event_occurred_brin" ON host_event USING brin ("occurredAt")`,
    ],
    host_inventory: [
      `CREATE TABLE host_inventory (
        "hostId" uuid NOT NULL,
        "factsHash" character varying(64) NOT NULL,
        platform character varying(16) NOT NULL,
        "osName" character varying(80),
        "osVersion" character varying(40),
        "kernelVersion" character varying(64),
        arch character varying(16) NOT NULL,
        hostname character varying(255) NOT NULL,
        "cpuModel" character varying(128),
        "cpuCount" smallint,
        "memoryTotalBytes" bigint,
        "diskTotalBytes" bigint,
        virtualization character varying(24),
        "cloudProvider" character varying(24),
        timezone character varying(64),
        "bootedAt" timestamp with time zone,
        "runnerVersion" character varying(40) NOT NULL,
        channel character varying(16),
        "serviceManager" character varying(16),
        tools jsonb DEFAULT '[]'::jsonb NOT NULL,
        facts jsonb NOT NULL,
        "changedAt" timestamp with time zone DEFAULT now() NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "CHK_host_inventory_cpu_count" CHECK ((("cpuCount" IS NULL) OR ("cpuCount" > 0))),
        CONSTRAINT "CHK_host_inventory_disk" CHECK ((("diskTotalBytes" IS NULL) OR ("diskTotalBytes" > 0))),
        CONSTRAINT "CHK_host_inventory_facts_hash" CHECK ((("factsHash")::text ~ '^[0-9a-f]{64}$'::text)),
        CONSTRAINT "CHK_host_inventory_memory" CHECK ((("memoryTotalBytes" IS NULL) OR ("memoryTotalBytes" > 0))),
        CONSTRAINT "CHK_host_inventory_platform" CHECK (platform IN ('macos', 'debian', 'ubuntu', 'linux', 'unsupported')),
        CONSTRAINT "CHK_host_inventory_tools_array" CHECK ((jsonb_typeof(tools) = 'array'::text))
      )`,
      `ALTER TABLE host_inventory ADD CONSTRAINT "PK_host_inventory" PRIMARY KEY ("hostId")`,
    ],
    host_network: [
      `CREATE TABLE host_network (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "hostId" uuid NOT NULL,
        ip inet NOT NULL,
        "countryCode" character(2),
        region character varying(64),
        city character varying(64),
        asn integer,
        "asnOrg" character varying(128),
        "firstSeenAt" timestamp with time zone DEFAULT now() NOT NULL,
        "lastSeenAt" timestamp with time zone DEFAULT now() NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "CHK_host_network_asn" CHECK (((asn IS NULL) OR (asn > 0))),
        CONSTRAINT "CHK_host_network_country" CHECK (("countryCode" ~ '^[A-Z]{2}$'::text)),
        CONSTRAINT "CHK_host_network_seen_order" CHECK (("lastSeenAt" >= "firstSeenAt"))
      )`,
      `ALTER TABLE host_network ADD CONSTRAINT "PK_host_network" PRIMARY KEY (id)`,
      `ALTER TABLE host_network ADD CONSTRAINT "UQ_host_network_host_ip" UNIQUE ("hostId", ip)`,
      `CREATE INDEX "IDX_host_network_last_seen" ON host_network USING btree ("lastSeenAt")`,
    ],
    host_pairing_token: [
      `CREATE TABLE host_pairing_token (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "ownerUserId" uuid NOT NULL,
        "intendedName" character varying(80) NOT NULL,
        prefix character varying(32) NOT NULL,
        "tokenHash" character varying(64) NOT NULL,
        "createdFromIp" inet,
        "redeemedFromIp" inet,
        "expiresAt" timestamp with time zone NOT NULL,
        "revokedAt" timestamp with time zone,
        "redeemedAt" timestamp with time zone,
        "redeemedHostId" uuid,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "CHK_host_pairing_token_redemption" CHECK ((("redeemedAt" IS NULL) = ("redeemedHostId" IS NULL)))
      )`,
      `ALTER TABLE host_pairing_token ADD CONSTRAINT "PK_host_pairing_token" PRIMARY KEY (id)`,
      `ALTER TABLE host_pairing_token ADD CONSTRAINT "UQ_host_pairing_token_hash" UNIQUE ("tokenHash")`,
      `CREATE INDEX "IDX_host_pairing_token_owner" ON host_pairing_token USING btree ("ownerUserId")`,
      `CREATE INDEX "IDX_host_pairing_token_redeemed_host" ON host_pairing_token USING btree ("redeemedHostId") WHERE ("redeemedHostId" IS NOT NULL)`,
    ],
    host_presence: [
      `CREATE TABLE host_presence (
        "hostId" uuid NOT NULL,
        "currentNetworkId" uuid,
        "connectedAt" timestamp with time zone,
        "lastSeenAt" timestamp with time zone NOT NULL,
        "roundTripMillis" integer,
        "loadAverage" numeric(7,2),
        "memoryAvailableBytes" bigint,
        "diskFreeBytes" bigint,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "CHK_host_presence_disk" CHECK ((("diskFreeBytes" IS NULL) OR ("diskFreeBytes" >= 0))),
        CONSTRAINT "CHK_host_presence_load" CHECK ((("loadAverage" IS NULL) OR ("loadAverage" >= (0)::numeric))),
        CONSTRAINT "CHK_host_presence_memory" CHECK ((("memoryAvailableBytes" IS NULL) OR ("memoryAvailableBytes" >= 0))),
        CONSTRAINT "CHK_host_presence_round_trip" CHECK ((("roundTripMillis" IS NULL) OR ("roundTripMillis" >= 0)))
      )
      WITH (fillfactor='70')`,
      `ALTER TABLE host_presence ADD CONSTRAINT "PK_host_presence" PRIMARY KEY ("hostId")`,
      `CREATE INDEX "IDX_host_presence_current_network" ON host_presence USING btree ("currentNetworkId") WHERE ("currentNetworkId" IS NOT NULL)`,
    ],
  },
  foreignKeys: [
    `ALTER TABLE host_event ADD CONSTRAINT "FK_host_event_host" FOREIGN KEY ("hostId") REFERENCES host(id) ON DELETE CASCADE`,
    `ALTER TABLE host_inventory ADD CONSTRAINT "FK_host_inventory_host" FOREIGN KEY ("hostId") REFERENCES host(id) ON DELETE CASCADE`,
    `ALTER TABLE host_network ADD CONSTRAINT "FK_host_network_host" FOREIGN KEY ("hostId") REFERENCES host(id) ON DELETE CASCADE`,
    `ALTER TABLE host ADD CONSTRAINT "FK_host_owner" FOREIGN KEY ("ownerUserId") REFERENCES "user"(id) ON DELETE CASCADE`,
    `ALTER TABLE host_pairing_token ADD CONSTRAINT "FK_host_pairing_token_host" FOREIGN KEY ("redeemedHostId") REFERENCES host(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED`,
    `ALTER TABLE host_pairing_token ADD CONSTRAINT "FK_host_pairing_token_owner" FOREIGN KEY ("ownerUserId") REFERENCES "user"(id) ON DELETE CASCADE`,
    `ALTER TABLE host_presence ADD CONSTRAINT "FK_host_presence_current_network" FOREIGN KEY ("currentNetworkId") REFERENCES host_network(id) ON DELETE SET NULL`,
    `ALTER TABLE host_presence ADD CONSTRAINT "FK_host_presence_host" FOREIGN KEY ("hostId") REFERENCES host(id) ON DELETE CASCADE`,
  ],
};
