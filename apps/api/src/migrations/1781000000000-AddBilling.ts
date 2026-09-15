import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Introduces Stripe billing:
 *   - `billing_customer` — maps a Oppenheimer user to their Stripe Customer id.
 *   - `subscription`     — a local mirror of a Stripe Subscription, kept in
 *                          sync through webhooks (status, price, amount, period).
 *
 * Both tables are application-owned and reference `user(id)` with an
 * `ON DELETE CASCADE` so billing rows disappear with their user.
 */
export class AddBilling1781000000000 implements MigrationInterface {
  name = 'AddBilling1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "billing_customer" ("id" uuid NOT NULL, "userId" uuid NOT NULL, "stripeCustomerId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_billing_customer_userId" UNIQUE ("userId"), CONSTRAINT "UQ_billing_customer_stripeCustomerId" UNIQUE ("stripeCustomerId"), CONSTRAINT "PK_billing_customer_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "billing_customer" ADD CONSTRAINT "FK_billing_customer_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "subscription" ("id" uuid NOT NULL, "userId" uuid NOT NULL, "stripeCustomerId" character varying NOT NULL, "stripeSubscriptionId" character varying NOT NULL, "stripePriceId" character varying, "plan" character varying, "unitAmount" integer, "currency" character varying, "interval" character varying, "status" character varying NOT NULL, "currentPeriodEnd" TIMESTAMP, "cancelAtPeriodEnd" boolean NOT NULL DEFAULT false, "canceledAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_subscription_stripeSubscriptionId" UNIQUE ("stripeSubscriptionId"), CONSTRAINT "PK_subscription_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_subscription_userId" ON "subscription" ("userId")`);
    await queryRunner.query(
      `ALTER TABLE "subscription" ADD CONSTRAINT "FK_subscription_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "subscription" DROP CONSTRAINT "FK_subscription_user"`);
    await queryRunner.query(`DROP INDEX "IDX_subscription_userId"`);
    await queryRunner.query(`DROP TABLE "subscription"`);

    await queryRunner.query(
      `ALTER TABLE "billing_customer" DROP CONSTRAINT "FK_billing_customer_user"`,
    );
    await queryRunner.query(`DROP TABLE "billing_customer"`);
  }
}
