import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The two tables a machine needs to become a host.
 *
 * `host` carries **no `organizationId`**: a host belongs to the person who
 * paired it and every workspace that person is in borrows it, so the owner
 * column is the only ownership column — the same shape Better Auth gives
 * `session` and `account` (`product/versions/mvp/08-auth.md`). What runs on a
 * host is scoped by the workspace of the session, not by the machine.
 *
 * `host_pairing_token` is the registration token: a credential that exists
 * before its subject does, which is why it is a table and not a column. Only
 * the digest of the secret is stored, and the unique index on it is the lookup
 * key of the single statement that spends one. Its owner column is named
 * `ownerUserId` like the host's, because it is the same person and the host it
 * redeems into inherits the value.
 *
 * The host's key is one column plus its fingerprint. The retired key that a
 * rotation window needs is not here: rotation is a frame on an authenticated
 * link (09 §3), nothing in this slice can write one, and three nullable columns
 * with no writer are harder to explain later than adding them then.
 *
 * Neither table's rows are hard-deleted: unpairing sets `unpairedAt`, and a
 * spent token is kept so the pairing history — including the two source
 * addresses — survives.
 */
export class AddHosts1788700000000 implements MigrationInterface {
  name = 'AddHosts1788700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "host" (
        "id"                            uuid NOT NULL DEFAULT gen_random_uuid(),
        "ownerUserId"                   uuid NOT NULL,
        "name"                          character varying(80) NOT NULL,
        "hostname"                      character varying(255),
        "os"                            character varying(40),
        "arch"                          character varying(40),
        "runnerVersion"                 character varying(40),
        "capabilities"                  jsonb,
        "publicKey"                     text NOT NULL,
        "publicKeyFingerprint"          character varying(64) NOT NULL,
        "lastSeenAt"                    TIMESTAMP WITH TIME ZONE,
        "unpairedAt"                    TIMESTAMP WITH TIME ZONE,
        "createdAt"                     TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"                     TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_host" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_host_public_key_fingerprint" UNIQUE ("publicKeyFingerprint"),
        CONSTRAINT "FK_host_owner"
          FOREIGN KEY ("ownerUserId") REFERENCES "user"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_host_owner" ON "host" ("ownerUserId")`);

    await queryRunner.query(`
      CREATE TABLE "host_pairing_token" (
        "id"               uuid NOT NULL DEFAULT gen_random_uuid(),
        "ownerUserId"      uuid NOT NULL,
        "intendedName"     character varying(80) NOT NULL,
        "prefix"           character varying(32) NOT NULL,
        "tokenHash"        character varying(64) NOT NULL,
        "createdFromIp"    inet,
        "redeemedFromIp"   inet,
        "expiresAt"        TIMESTAMP WITH TIME ZONE NOT NULL,
        "revokedAt"        TIMESTAMP WITH TIME ZONE,
        "redeemedAt"       TIMESTAMP WITH TIME ZONE,
        "redeemedHostId"   uuid,
        "createdAt"        TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"        TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_host_pairing_token" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_host_pairing_token_hash" UNIQUE ("tokenHash"),
        CONSTRAINT "FK_host_pairing_token_owner"
          FOREIGN KEY ("ownerUserId") REFERENCES "user"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        -- Deferred, because redemption writes this column in the same statement
        -- that claims the token and the host it names is inserted later in the
        -- same transaction. Checking it immediately would force the insert to
        -- come first, which would mean creating a host before knowing whether
        -- the token could be spent at all.
        CONSTRAINT "FK_host_pairing_token_host"
          FOREIGN KEY ("redeemedHostId") REFERENCES "host"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION
          DEFERRABLE INITIALLY DEFERRED,
        -- The host and the moment are written by the same statement, so one
        -- without the other means the redemption was not atomic after all.
        CONSTRAINT "CHK_host_pairing_token_redemption"
          CHECK (("redeemedAt" IS NULL) = ("redeemedHostId" IS NULL))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_host_pairing_token_owner" ON "host_pairing_token" ("ownerUserId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_host_pairing_token_owner"`);
    await queryRunner.query(`DROP TABLE "host_pairing_token"`);
    await queryRunner.query(`DROP INDEX "IDX_host_owner"`);
    await queryRunner.query(`DROP TABLE "host"`);
  }
}
