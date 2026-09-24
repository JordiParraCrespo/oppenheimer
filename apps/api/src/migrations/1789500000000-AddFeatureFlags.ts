import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Feature-flag targeting, segments and the audit trail.
 *
 * Flags themselves are declared in code (`FEATURE_FLAGS` in `@oppenheimer/shared/feature-flags`);
 * these tables hold only what an operator changes at runtime. Nothing is
 * seeded: a flag with no row serves its catalog default, so a fresh install
 * and an upgraded one behave identically until someone saves targeting.
 *
 * `feature_flag_change.actorId` has no foreign key on purpose — who pulled a
 * kill switch must stay on record after their account is deleted. Its id is
 * the id of the domain event that produced it, which is what makes recording
 * idempotent under the outbox's at-least-once delivery.
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
        "key"         character varying NOT NULL,
        "enabled"     boolean NOT NULL DEFAULT false,
        "rules"       jsonb NOT NULL DEFAULT '[]',
        "fallthrough" jsonb NOT NULL,
        "salt"        character varying NOT NULL,
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
        "key"         character varying NOT NULL,
        "name"        character varying NOT NULL,
        "description" character varying,
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
        "subjectType" character varying NOT NULL,
        "subjectKey"  character varying NOT NULL,
        "action"      character varying NOT NULL,
        "actorId"     uuid,
        "comment"     character varying,
        "before"      jsonb,
        "after"       jsonb,
        "createdAt"   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feature_flag_change" PRIMARY KEY ("id")
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
