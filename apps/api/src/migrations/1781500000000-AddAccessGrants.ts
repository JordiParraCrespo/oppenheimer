import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the generic access-grant table — the second scope dimension.
 *
 * Team membership answers "this team sees its own rows". This answers the cases
 * membership cannot: a named auditor granted three specific records, a
 * contractor granted one warehouse until the end of the month. Making it
 * polymorphic is what stops each new axis growing its own table and resolver.
 */
export class AddAccessGrants1781500000000 implements MigrationInterface {
  name = 'AddAccessGrants1781500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "access_grant" (
        "id"             uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "principalType"  character varying NOT NULL,
        "principalId"    uuid NOT NULL,
        "resourceType"   character varying NOT NULL,
        "resourceId"     uuid,
        "grantedBy"      uuid NOT NULL,
        "expiresAt"      TIMESTAMP WITH TIME ZONE,
        "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_access_grant" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_access_grant_principal_type"
          CHECK ("principalType" IN ('user', 'team', 'role')),
        CONSTRAINT "FK_access_grant_organization"
          FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // The resolver's hot path: every grant reaching this principal set, in this
    // organization, for one resource type.
    await queryRunner.query(
      `CREATE INDEX "IDX_access_grant_lookup" ON "access_grant" ("organizationId", "principalType", "principalId", "resourceType")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_access_grant_expiry" ON "access_grant" ("expiresAt") WHERE "expiresAt" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_access_grant_expiry"`);
    await queryRunner.query(`DROP INDEX "IDX_access_grant_lookup"`);
    await queryRunner.query(`DROP TABLE "access_grant"`);
  }
}
