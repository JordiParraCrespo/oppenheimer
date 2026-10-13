import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `session_share` replaces `session_share_link`
 * (`product/versions/mvp/21-session-share-links.md`, decided 2026-10-13): a
 * session is shared once, at one stable address, to named people or to
 * anyone signed in with the address, instead of through many bearer links
 * whose secret was shown once. The links made since 2026-10-08 are dropped,
 * not converted: their owners share again.
 *
 * Access patterns: a guest's lookup by address (`UQ_…_slug`); the owner's
 * read and write of a session's share (`UQ_…_session`, which is also the
 * one-share-per-session rule, the upsert's conflict target and the index
 * behind the composite foreign key); an account's erasure
 * (`IDX_…_shared_by`, backing its foreign key). `audience` and `access` are
 * closed vocabularies with a `CHECK` each, a list of people exists exactly
 * when the audience is `people`, a link only watches, and write access ends
 * within a day of being set (the minute of slack is the gap between the
 * app's clock, which sets `expiresAt`, and the database's, which sets
 * `updatedAt`). A session holds one row and a row at most fifty emails, so
 * the table grows with sessions. An expired share opens nothing and stays
 * until its owner stops it or shares again, or the session is erased.
 */
export class ReplaceShareLinksWithSessionShares1791000800000 implements MigrationInterface {
  name = 'ReplaceShareLinksWithSessionShares1791000800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE session_share_link');
    await queryRunner.query(
      `CREATE TABLE session_share (
        id uuid NOT NULL,
        "organizationId" uuid NOT NULL,
        "sessionId" uuid NOT NULL,
        "sharedByUserId" uuid NOT NULL,
        slug character varying(22) NOT NULL,
        audience character varying(8) NOT NULL,
        access character varying(8) NOT NULL,
        people text[] DEFAULT '{}'::text[] NOT NULL,
        "expiresAt" timestamp with time zone,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_session_share" PRIMARY KEY (id),
        CONSTRAINT "CHK_session_share_access" CHECK (access IN ('read', 'write')),
        CONSTRAINT "CHK_session_share_audience" CHECK (audience IN ('people', 'link')),
        CONSTRAINT "CHK_session_share_people" CHECK ((audience = 'people') = (cardinality(people) > 0)),
        CONSTRAINT "CHK_session_share_link_reads" CHECK (audience = 'people' OR access = 'read'),
        CONSTRAINT "CHK_session_share_write_expires" CHECK (access = 'read' OR ("expiresAt" IS NOT NULL AND "expiresAt" <= "updatedAt" + interval '24 hours 1 minute'))
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_session_share_slug" ON session_share USING btree (slug)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_session_share_session" ON session_share USING btree ("organizationId", "sessionId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_session_share_shared_by" ON session_share USING btree ("sharedByUserId")`,
    );
    await queryRunner.query(
      `ALTER TABLE session_share ADD CONSTRAINT "FK_session_share_session" FOREIGN KEY ("organizationId", "sessionId") REFERENCES work_session("organizationId", id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE session_share ADD CONSTRAINT "FK_session_share_shared_by" FOREIGN KEY ("sharedByUserId") REFERENCES "user"(id) ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE session_share');
    await queryRunner.query(
      `CREATE TABLE session_share_link (
        id uuid NOT NULL,
        "organizationId" uuid NOT NULL,
        "sessionId" uuid NOT NULL,
        "createdByUserId" uuid NOT NULL,
        "tokenHash" character varying(64) NOT NULL,
        access character varying(8) NOT NULL,
        audience character varying(16) NOT NULL,
        people text[] DEFAULT '{}'::text[] NOT NULL,
        label character varying(80),
        "expiresAt" timestamp with time zone,
        "revokedAt" timestamp with time zone,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_session_share_link" PRIMARY KEY (id),
        CONSTRAINT "CHK_session_share_link_access" CHECK (access IN ('read', 'write')),
        CONSTRAINT "CHK_session_share_link_audience" CHECK (audience IN ('anyone', 'accounts', 'people')),
        CONSTRAINT "CHK_session_share_link_people" CHECK ((audience = 'people') = (cardinality(people) > 0)),
        CONSTRAINT "CHK_session_share_link_open_write_expires" CHECK (NOT (access = 'write' AND audience = 'anyone') OR ("expiresAt" IS NOT NULL AND "expiresAt" <= "createdAt" + interval '7 days 1 minute'))
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_session_share_link_token_hash" ON session_share_link USING btree ("tokenHash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_session_share_link_session" ON session_share_link USING btree ("organizationId", "sessionId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_session_share_link_created_by" ON session_share_link USING btree ("createdByUserId")`,
    );
    await queryRunner.query(
      `ALTER TABLE session_share_link ADD CONSTRAINT "FK_session_share_link_session" FOREIGN KEY ("organizationId", "sessionId") REFERENCES work_session("organizationId", id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE session_share_link ADD CONSTRAINT "FK_session_share_link_created_by" FOREIGN KEY ("createdByUserId") REFERENCES "user"(id) ON DELETE CASCADE`,
    );
  }
}
