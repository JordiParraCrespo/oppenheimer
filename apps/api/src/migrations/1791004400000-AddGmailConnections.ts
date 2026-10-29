import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Mail (`product/next-steps/mail.md` §1): `gmail_connection`, a person's own
 * Gmail grant, up to five per person per workspace, worked by their bots.
 *
 * No mail is stored. The only row is the grant: the refresh token, sealed with
 * AES-256-GCM under `MAIL_TOKEN_KEY` (`bytea`), the Google account it belongs
 * to (keyed by Google's `sub`), the name the person gives it, and the scopes
 * Google granted.
 *
 * Access patterns:
 * - a person's accounts, listed in Settings and by a bot's turn, and one of
 *   them by id: `UQ_gmail_connection_user_account`, whose leading column
 *   backs the foreign key to the workspace;
 * - the foreign key to the person: `IDX_gmail_connection_user`.
 *
 * It goes with the workspace and with the person. `owner` gains `manage Mail`
 * in its workspace; every read of a connection adds its owner, so a workspace
 * owner never reaches another person's mailbox.
 */
export class AddGmailConnections1791004400000 implements MigrationInterface {
  name = 'AddGmailConnections1791004400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE gmail_connection (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "googleSubject" character varying(255) NOT NULL,
        "accountEmail" character varying(320) NOT NULL,
        label character varying(64) NOT NULL,
        "refreshTokenSealed" bytea NOT NULL,
        scopes text[] DEFAULT '{}'::text[] NOT NULL,
        status character varying(16) DEFAULT 'active'::character varying NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_gmail_connection" PRIMARY KEY (id),
        CONSTRAINT "CHK_gmail_connection_status" CHECK (status IN ('active', 'revoked'))
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_gmail_connection_user_account" ON gmail_connection USING btree ("organizationId", "userId", "googleSubject")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_gmail_connection_user" ON gmail_connection USING btree ("userId")`,
    );
    for (const statement of FOREIGN_KEYS) await queryRunner.query(statement);

    await queryRunner.query(
      `UPDATE "role" SET permissions = permissions || $1::jsonb
        WHERE name = 'owner' AND "organizationId" IS NULL AND "isSystem"`,
      [JSON.stringify(OWNER_RULES)],
    );
    await queryRunner.query(`UPDATE "role_catalog_version" SET "version" = "version" + 1`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "role" SET permissions = (
         SELECT COALESCE(jsonb_agg(rule), '[]'::jsonb)
           FROM jsonb_array_elements(permissions) rule
          WHERE NOT (rule->>'subject' = ANY($1))
       )
       WHERE name = 'owner' AND "organizationId" IS NULL AND "isSystem"`,
      [OWNER_RULES.map((rule) => rule.subject)],
    );
    await queryRunner.query(`UPDATE "role_catalog_version" SET "version" = "version" + 1`);
    await queryRunner.query('DROP TABLE gmail_connection');
  }
}

const OWNER_RULES = [
  {
    action: 'manage',
    subject: 'Mail',
    conditions: { organizationId: '${activeOrganizationId}' },
  },
];

const FOREIGN_KEYS = [
  `ALTER TABLE gmail_connection ADD CONSTRAINT "FK_gmail_connection_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
  `ALTER TABLE gmail_connection ADD CONSTRAINT "FK_gmail_connection_user" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE`,
];
