import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops the tables of the starter's Stripe `billing` module and its `leads`
 * example: `billing_customer` and `subscription` (`AddBilling`,
 * `AddSubscriptionLastEventAt`) and `lead` (`AddLeads`).
 *
 * Neither module was ever composed into this API, so no code path ever wrote
 * these tables: on every deployment they are empty, and dropping them loses
 * nothing. The migrations that created them stay as they are, because deployed
 * databases have recorded them and TypeORM replays history in order; this one
 * is the step after them, not an edit of them.
 *
 * `IF EXISTS` so the drop is a no-op on a database where someone already
 * removed them by hand. There is no dependency between the three, so the order
 * is simply the reverse of creation. Each drop also removes that table's own
 * foreign keys, which takes a lock on `user`, `organization` and `team` for the
 * rest of the boot transaction; the tables are empty, so each drop is a
 * catalogue change and the lock is released as soon as the migrations commit.
 *
 * `down` recreates them exactly as history left them: the columns, defaults,
 * named constraints and indexes of the three old migrations, with every point
 * in time as `timestamptz`, which is what `StoreTimestampsWithTimeZone` turned
 * their `TIMESTAMP` columns into. `subscription."lastEventAt"` is last because
 * it was added after the table. Nothing is restored into them because nothing
 * was ever in them.
 */
export class DropBillingAndLeads1789600000000 implements MigrationInterface {
  name = 'DropBillingAndLeads1789600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lead"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscription"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "billing_customer"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "billing_customer" (
        "id"               uuid NOT NULL,
        "userId"           uuid NOT NULL,
        "stripeCustomerId" character varying NOT NULL,
        "createdAt"        timestamptz NOT NULL DEFAULT now(),
        "updatedAt"        timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_billing_customer_userId" UNIQUE ("userId"),
        CONSTRAINT "UQ_billing_customer_stripeCustomerId" UNIQUE ("stripeCustomerId"),
        CONSTRAINT "PK_billing_customer_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "billing_customer" ADD CONSTRAINT "FK_billing_customer_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`
      CREATE TABLE "subscription" (
        "id"                   uuid NOT NULL,
        "userId"               uuid NOT NULL,
        "stripeCustomerId"     character varying NOT NULL,
        "stripeSubscriptionId" character varying NOT NULL,
        "stripePriceId"        character varying,
        "plan"                 character varying,
        "unitAmount"           integer,
        "currency"             character varying,
        "interval"             character varying,
        "status"               character varying NOT NULL,
        "currentPeriodEnd"     timestamptz,
        "cancelAtPeriodEnd"    boolean NOT NULL DEFAULT false,
        "canceledAt"           timestamptz,
        "createdAt"            timestamptz NOT NULL DEFAULT now(),
        "updatedAt"            timestamptz NOT NULL DEFAULT now(),
        "lastEventAt"          timestamptz,
        CONSTRAINT "UQ_subscription_stripeSubscriptionId" UNIQUE ("stripeSubscriptionId"),
        CONSTRAINT "PK_subscription_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_subscription_userId" ON "subscription" ("userId")`);
    await queryRunner.query(
      `ALTER TABLE "subscription" ADD CONSTRAINT "FK_subscription_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`
      CREATE TABLE "lead" (
        "id"             uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "teamId"         uuid,
        "ownerId"        uuid,
        "name"           character varying NOT NULL,
        "email"          character varying,
        "value"          bigint NOT NULL DEFAULT 0,
        "notes"          text,
        "createdAt"      timestamptz NOT NULL DEFAULT now(),
        "updatedAt"      timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lead" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lead_organization"
          FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_lead_team"
          FOREIGN KEY ("teamId") REFERENCES "team"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_lead_organization" ON "lead" ("organizationId")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_lead_organization_team" ON "lead" ("organizationId", "teamId")`,
    );
  }
}
