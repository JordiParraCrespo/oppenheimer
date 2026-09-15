import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The reference resource for the authorization kernel.
 *
 * The three scope columns are the point: `organizationId` for tenant
 * isolation, `teamId` for team scoping, `ownerId` for own-resource rules. They
 * are what `leads.resource.ts` names, and all the kernel needs to filter rows.
 */
export class AddLeads1781600000000 implements MigrationInterface {
  name = 'AddLeads1781600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
        "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP NOT NULL DEFAULT now(),
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_lead_organization_team"`);
    await queryRunner.query(`DROP INDEX "IDX_lead_organization"`);
    await queryRunner.query(`DROP TABLE "lead"`);
  }
}
