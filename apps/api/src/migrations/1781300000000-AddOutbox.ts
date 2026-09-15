import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the transactional outbox (`outbox_message`).
 *
 * Side effects owed by a state change — domain events, queued jobs — are
 * written here **inside the same transaction** as the state change, closing
 * the `commit(); enqueue();` window in which a Redis blip or a killed process
 * silently loses the side effect. A relay claims due rows with
 * `FOR UPDATE SKIP LOCKED` (multiple API replicas lease disjoint rows), and a
 * lapsed `lockedUntil` lease makes a dead owner's rows reclaimable.
 *
 * `aggregateId` has **no foreign key** — deliberately, so the queue outlives
 * the records it names: a deleted aggregate's events must still deliver.
 */
export class AddOutbox1781300000000 implements MigrationInterface {
  name = 'AddOutbox1781300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "outbox_message" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "channel" character varying(16) NOT NULL DEFAULT 'event',
        "topic" character varying,
        "eventName" character varying NOT NULL,
        "aggregateId" character varying,
        "payload" jsonb NOT NULL,
        "reason" text NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "availableAt" TIMESTAMP NOT NULL DEFAULT now(),
        "lockedBy" character varying,
        "lockedUntil" TIMESTAMP,
        "lastError" text,
        "correlationId" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "processedAt" TIMESTAMP,
        CONSTRAINT "PK_outbox_message" PRIMARY KEY ("id")
      )`,
    );
    // The relay's claim query filters on exactly this pair.
    await queryRunner.query(
      `CREATE INDEX "IDX_outbox_message_status_available" ON "outbox_message" ("status", "availableAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_outbox_message_status_available"`);
    await queryRunner.query(`DROP TABLE "outbox_message"`);
  }
}
