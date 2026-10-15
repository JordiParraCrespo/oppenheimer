import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A workspace's projects go with it. Every workspace is given an Unassigned
 * project the moment it is made, so `FK_project_organization`'s `RESTRICT`
 * refused every organization delete there is: Better Auth's delete failed on
 * it and the API answered 502. A project is the workspace's own saved scope
 * and means nothing without it, which is `CASCADE` (`database-design.md`);
 * its `project_repository` rows already cascade from the project.
 *
 * What still refuses the delete is deliberate and unchanged: a workspace with
 * sessions. `FK_work_session_organization` and `FK_work_session_project` stay
 * `RESTRICT`, so a session that may be running on a host is never deleted out
 * from under it by a workspace delete.
 */
export class CascadeProjectsWithTheirOrganization1791001500000 implements MigrationInterface {
  name = 'CascadeProjectsWithTheirOrganization1791001500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE project DROP CONSTRAINT "FK_project_organization"`);
    await queryRunner.query(
      `ALTER TABLE project ADD CONSTRAINT "FK_project_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE project DROP CONSTRAINT "FK_project_organization"`);
    await queryRunner.query(
      `ALTER TABLE project ADD CONSTRAINT "FK_project_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE RESTRICT`,
    );
  }
}
