import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `session_share_link`: a link that opens one session's terminal to people
 * outside its workspace (`product/versions/mvp/21-session-share-links.md`).
 *
 * Only the SHA-256 of a link's secret is stored, unique, since it is what a
 * holder's every request is looked up by. The session key is composite on
 * the workspace, so a link cannot name another workspace's session, and both
 * parents cascade: closing and erasing a session, or erasing the account that
 * shared it, takes its links. A revoked link is kept until then, for the list;
 * a session holds at most twenty live ones, so the table grows with sessions.
 *
 * Access patterns: a holder's lookup by digest (`UQ_…_token_hash`); a
 * session's list and the live-link count at a create
 * (`IDX_…_session`, which also backs the composite foreign key); an
 * account's erasure (`IDX_…_created_by`, backing its foreign key). `access`
 * and `audience` are closed vocabularies with a `CHECK` each, and a list of
 * people exists exactly when the audience is `people`.
 */
export class AddSessionShareLinks1791000600000 implements MigrationInterface {
  name = 'AddSessionShareLinks1791000600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
        CONSTRAINT "CHK_session_share_link_people" CHECK ((audience = 'people') = (cardinality(people) > 0))
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE session_share_link');
  }
}
