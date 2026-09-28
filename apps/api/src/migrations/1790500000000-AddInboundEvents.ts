import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The inbound-events hub: what external systems told us, stored once
 * (`product/versions/mvp/16-automations-architecture.md` §Q6, §Q7).
 *
 * Two tables, because a delivery and an event are different facts:
 *
 * - **`inbound_delivery`** is the webhook request as it arrived — the source,
 *   the source's own delivery id, the event name and the raw body. It is
 *   written before anything is interpreted (accept fast, process later), so a
 *   bug in a normalizer is fixed by re-processing the delivery rather than
 *   lost with it. It has no workspace: which workspaces a delivery concerns is
 *   what processing works out. Raw bodies are kept for the **7-day** replay
 *   window. They are in Postgres rather than object storage so that the
 *   delivery row and the job that owes its processing commit together; TOAST
 *   compresses them, and moving them out is a change for when volume asks.
 * - **`inbound_event`** is one normalized event in one workspace: the
 *   canonical type from the trigger catalog, the subject it happened to, the
 *   actor, the flat attributes filters read and the untrusted context a run's
 *   prompt carries. Kept **30 days**, which serves the editor's "would have run
 *   N times in the last 7 days" preview and debugging a recent run.
 *
 * Idempotency: a delivery is `(source, deliveryId)`, so a provider's retry
 * lands on the row already there. An event is `(organizationId, source,
 * externalId)`, the delivery id plus the canonical type, because one delivery
 * can be two events (a comment that also mentions the App).
 *
 * Access patterns:
 *
 *   Q1  receive a delivery, once                → UQ_inbound_delivery_source_delivery
 *   Q2  the trigger preview: one workspace's events of a type on some
 *       subjects in the last N days            → IDX_inbound_event_preview
 *   Q3  an event by id, for a run's cause       → PK
 *   Q4  retention deletes by age                → the two BRIN indexes
 *   Q5  events of a delivery (re-processing)    → IDX_inbound_event_delivery
 *
 * `inbound_event."inboundDeliveryId"` is `SET NULL`: the delivery is purged a
 * week before the event is. A workspace's events cascade with it; their volume
 * is bounded by the 30-day retention, so the cascade is bounded too.
 */
export class AddInboundEvents1790500000000 implements MigrationInterface {
  name = 'AddInboundEvents1790500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "inbound_delivery" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "source" varchar(32) NOT NULL,
        "deliveryId" varchar(128) NOT NULL,
        "eventName" varchar(64) NOT NULL,
        "payload" jsonb NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'received',
        "eventCount" integer NOT NULL DEFAULT 0,
        "lastError" text,
        "receivedAt" timestamptz NOT NULL DEFAULT now(),
        "processedAt" timestamptz,
        CONSTRAINT "PK_inbound_delivery" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_inbound_delivery_source_delivery" UNIQUE ("source", "deliveryId"),
        CONSTRAINT "CHK_inbound_delivery_source" CHECK ("source" IN ('github')),
        CONSTRAINT "CHK_inbound_delivery_status"
          CHECK ("status" IN ('received', 'processed', 'failed')),
        CONSTRAINT "CHK_inbound_delivery_payload" CHECK (jsonb_typeof("payload") = 'object'),
        CONSTRAINT "CHK_inbound_delivery_event_count" CHECK ("eventCount" >= 0)
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inbound_delivery_received_brin"
         ON "inbound_delivery" USING brin ("receivedAt")`,
    );

    await queryRunner.query(
      `CREATE TABLE "inbound_event" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "inboundDeliveryId" uuid,
        "source" varchar(32) NOT NULL,
        "externalId" varchar(200) NOT NULL,
        "eventType" varchar(64) NOT NULL,
        "subjectKind" varchar(32) NOT NULL,
        "subjectRef" varchar(128) NOT NULL,
        "actorLogin" varchar(255),
        "actorIsOwnApp" boolean NOT NULL DEFAULT false,
        "attributes" jsonb NOT NULL DEFAULT '{}',
        "context" jsonb NOT NULL DEFAULT '{}',
        "schemaVersion" smallint NOT NULL DEFAULT 1,
        "occurredAt" timestamptz NOT NULL,
        "receivedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inbound_event" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_inbound_event_organization_external"
          UNIQUE ("organizationId", "source", "externalId"),
        CONSTRAINT "UQ_inbound_event_organization_id" UNIQUE ("organizationId", "id"),
        CONSTRAINT "FK_inbound_event_organization"
          FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_inbound_event_delivery"
          FOREIGN KEY ("inboundDeliveryId") REFERENCES "inbound_delivery" ("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_inbound_event_source" CHECK ("source" IN ('github')),
        CONSTRAINT "CHK_inbound_event_attributes" CHECK (jsonb_typeof("attributes") = 'object'),
        CONSTRAINT "CHK_inbound_event_context" CHECK (jsonb_typeof("context") = 'object'),
        CONSTRAINT "CHK_inbound_event_schema_version" CHECK ("schemaVersion" >= 1)
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inbound_event_preview"
         ON "inbound_event" ("organizationId", "source", "eventType", "subjectRef", "occurredAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inbound_event_delivery" ON "inbound_event" ("inboundDeliveryId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inbound_event_received_brin" ON "inbound_event" USING brin ("receivedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_inbound_event_received_brin"`);
    await queryRunner.query(`DROP INDEX "IDX_inbound_event_delivery"`);
    await queryRunner.query(`DROP INDEX "IDX_inbound_event_preview"`);
    await queryRunner.query(`DROP TABLE "inbound_event"`);
    await queryRunner.query(`DROP INDEX "IDX_inbound_delivery_received_brin"`);
    await queryRunner.query(`DROP TABLE "inbound_delivery"`);
  }
}
