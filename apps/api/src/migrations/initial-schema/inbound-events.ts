import type { SchemaSlice } from './schema-slice';

/** `inbound_delivery`, `inbound_event`. See each table's ORM entity under `src/inbound-events/` for why it is shaped this way. */
export const inboundEvents: SchemaSlice = {
  tables: {
    inbound_delivery: [
      `CREATE TABLE inbound_delivery (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        source character varying(32) NOT NULL,
        "deliveryId" character varying(128) NOT NULL,
        "eventName" character varying(64) NOT NULL,
        payload jsonb NOT NULL,
        status character varying(16) DEFAULT 'received'::character varying NOT NULL,
        "eventCount" integer DEFAULT 0 NOT NULL,
        "lastError" text,
        "receivedAt" timestamp with time zone DEFAULT now() NOT NULL,
        "processedAt" timestamp with time zone,
        "restagedAt" timestamp with time zone,
        "payloadDigest" character varying(64),
        CONSTRAINT "CHK_inbound_delivery_event_count" CHECK (("eventCount" >= 0)),
        CONSTRAINT "CHK_inbound_delivery_payload" CHECK ((jsonb_typeof(payload) = 'object'::text)),
        CONSTRAINT "CHK_inbound_delivery_source" CHECK (((source)::text = 'github'::text)),
        CONSTRAINT "CHK_inbound_delivery_status" CHECK (status IN ('received', 'processed', 'failed'))
      )`,
      `ALTER TABLE inbound_delivery ADD CONSTRAINT "PK_inbound_delivery" PRIMARY KEY (id)`,
      `ALTER TABLE inbound_delivery ADD CONSTRAINT "UQ_inbound_delivery_source_delivery" UNIQUE (source, "deliveryId")`,
      `CREATE INDEX "IDX_inbound_delivery_received_brin" ON inbound_delivery USING brin ("receivedAt")`,
      `CREATE INDEX "IDX_inbound_delivery_unprocessed" ON inbound_delivery USING btree ("receivedAt") WHERE ((status)::text = 'received'::text)`,
      `CREATE UNIQUE INDEX "UQ_inbound_delivery_source_payload" ON inbound_delivery USING btree (source, "payloadDigest") WHERE ("payloadDigest" IS NOT NULL)`,
    ],
    inbound_event: [
      `CREATE TABLE inbound_event (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "inboundDeliveryId" uuid,
        source character varying(32) NOT NULL,
        "externalId" character varying(200) NOT NULL,
        "eventType" character varying(64) NOT NULL,
        "subjectKind" character varying(32) NOT NULL,
        "subjectRef" character varying(128) NOT NULL,
        "actorLogin" character varying(255),
        "actorIsOwnApp" boolean DEFAULT false NOT NULL,
        attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
        context jsonb DEFAULT '{}'::jsonb NOT NULL,
        "schemaVersion" smallint DEFAULT 1 NOT NULL,
        "occurredAt" timestamp with time zone NOT NULL,
        "receivedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "CHK_inbound_event_attributes" CHECK ((jsonb_typeof(attributes) = 'object'::text)),
        CONSTRAINT "CHK_inbound_event_context" CHECK ((jsonb_typeof(context) = 'object'::text)),
        CONSTRAINT "CHK_inbound_event_schema_version" CHECK (("schemaVersion" >= 1)),
        CONSTRAINT "CHK_inbound_event_source" CHECK (((source)::text = 'github'::text))
      )`,
      `ALTER TABLE inbound_event ADD CONSTRAINT "PK_inbound_event" PRIMARY KEY (id)`,
      `ALTER TABLE inbound_event ADD CONSTRAINT "UQ_inbound_event_organization_external" UNIQUE ("organizationId", source, "externalId")`,
      `ALTER TABLE inbound_event ADD CONSTRAINT "UQ_inbound_event_organization_id" UNIQUE ("organizationId", id)`,
      `CREATE INDEX "IDX_inbound_event_delivery" ON inbound_event USING btree ("inboundDeliveryId")`,
      `CREATE INDEX "IDX_inbound_event_preview" ON inbound_event USING btree ("organizationId", source, "eventType", "subjectRef", "occurredAt")`,
      `CREATE INDEX "IDX_inbound_event_received_brin" ON inbound_event USING brin ("receivedAt")`,
    ],
  },
  foreignKeys: [
    `ALTER TABLE inbound_event ADD CONSTRAINT "FK_inbound_event_delivery" FOREIGN KEY ("inboundDeliveryId") REFERENCES inbound_delivery(id) ON DELETE SET NULL`,
    `ALTER TABLE inbound_event ADD CONSTRAINT "FK_inbound_event_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
  ],
};
