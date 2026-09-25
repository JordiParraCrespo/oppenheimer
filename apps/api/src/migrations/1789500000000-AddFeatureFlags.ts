import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Feature-flag targeting, segments and the audit trail.
 *
 * Flags themselves are declared in code (`FEATURE_FLAGS` in
 * `@oppenheimer/shared/feature-flags`); these tables hold only what an operator
 * changes at runtime. Nothing is seeded: a flag with no row serves its catalog
 * default, so a fresh install and an upgraded one behave identically until
 * someone saves targeting.
 *
 * Access patterns, and what serves each:
 *
 * - every flag and every segment, whole — the snapshot each API replica loads
 *   and re-reads when its fingerprint changes. Both tables are one row per
 *   catalog key or named audience (tens of rows), so a sequential scan is the
 *   plan and no index is added for it.
 * - one flag or segment by key (the admin reads and every write):
 *   `UQ_feature_flag_key`, `UQ_feature_flag_segment_key`.
 * - the audit trail for one subject, newest first:
 *   `IDX_feature_flag_change_subject` (`subjectType`, `subjectKey`,
 *   `createdAt`).
 * - the whole audit trail, newest first: `IDX_feature_flag_change_created`.
 *   Filtered by `subjectType` alone (two values) the planner walks this one
 *   too and filters, which is cheaper than a third index.
 *
 * Checked on Postgres 16 with `check-migration.mjs` and 5 000 change rows:
 * every pattern above is an index scan with no `Sort`.
 *
 * Keys are app-generated, not `gen_random_uuid()`: a flag's and a segment's id
 * is the aggregate's own, and a `feature_flag_change` row's id is the id of the
 * domain event that produced it, which is what makes recording idempotent under
 * the outbox's at-least-once delivery.
 *
 * `updatedBy` and `actorId` have no foreign key on purpose — who pulled a kill
 * switch must stay on record after their account is deleted — and no index,
 * because nothing looks a change up by its actor.
 *
 * Lengths follow the write schemas in `@oppenheimer/shared/feature-flags`
 * (keys 64, segment names 100, descriptions 255, comments 500). `subjectType`
 * and `action` are closed sets, mirrored by `FlagChangeSubject` and
 * `FlagChangeAction`.
 *
 * `feature_flag_change` is append-only (no `updatedAt`) and kept for the life
 * of the deployment: it grows by one row per operator change, not with
 * traffic, so it needs neither a retention job nor partitioning.
 *
 * Every point in time is `timestamptz`, like every other table since
 * `StoreTimestampsWithTimeZone`.
 */
export class AddFeatureFlags1789500000000 implements MigrationInterface {
  name = 'AddFeatureFlags1789500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "feature_flag" (
        "id"          uuid NOT NULL,
        "key"         character varying(64) NOT NULL,
        "enabled"     boolean NOT NULL DEFAULT false,
        "rules"       jsonb NOT NULL DEFAULT '[]',
        "fallthrough" jsonb NOT NULL,
        "salt"        character varying(32) NOT NULL,
        "updatedBy"   uuid,
        "createdAt"   timestamptz NOT NULL DEFAULT now(),
        "updatedAt"   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feature_flag" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_feature_flag_key" UNIQUE ("key")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "feature_flag_segment" (
        "id"          uuid NOT NULL,
        "key"         character varying(64) NOT NULL,
        "name"        character varying(100) NOT NULL,
        "description" character varying(255),
        "conditions"  jsonb NOT NULL DEFAULT '[]',
        "updatedBy"   uuid,
        "createdAt"   timestamptz NOT NULL DEFAULT now(),
        "updatedAt"   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feature_flag_segment" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_feature_flag_segment_key" UNIQUE ("key")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "feature_flag_change" (
        "id"          uuid NOT NULL,
        "subjectType" character varying(16) NOT NULL,
        "subjectKey"  character varying(64) NOT NULL,
        "action"      character varying(32) NOT NULL,
        "actorId"     uuid,
        "comment"     character varying(500),
        "before"      jsonb,
        "after"       jsonb,
        "createdAt"   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feature_flag_change" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_feature_flag_change_subject_type"
          CHECK ("subjectType" IN ('flag', 'segment')),
        CONSTRAINT "CHK_feature_flag_change_action"
          CHECK ("action" IN ('targeting_updated', 'toggled', 'segment_created', 'segment_updated', 'segment_deleted'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_feature_flag_change_subject"
        ON "feature_flag_change" ("subjectType", "subjectKey", "createdAt")
    `);
    // The unfiltered feed, newest first.
    await queryRunner.query(`
      CREATE INDEX "IDX_feature_flag_change_created" ON "feature_flag_change" ("createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_feature_flag_change_created"`);
    await queryRunner.query(`DROP INDEX "IDX_feature_flag_change_subject"`);
    await queryRunner.query(`DROP TABLE "feature_flag_change"`);
    await queryRunner.query(`DROP TABLE "feature_flag_segment"`);
    await queryRunner.query(`DROP TABLE "feature_flag"`);
  }
}
