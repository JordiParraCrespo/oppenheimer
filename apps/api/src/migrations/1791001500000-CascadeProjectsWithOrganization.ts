import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A project goes with its organization.
 *
 * `FK_project_organization` was `RESTRICT`, so once a workspace had its
 * Unassigned project (made for it, after the fact, by the `projects` module's
 * listener on the organization being created) the workspace could never be
 * deleted: Better Auth's delete removed the organization row and Postgres
 * refused. Every other table an organization owns cascades, and a project is
 * metadata (`product/versions/mvp/10-api-modules-and-data-model.md`); its own
 * children (tasks, milestones, automations, repositories) already cascade
 * from it. Work is still kept: `work_session` stays `RESTRICT` against both
 * the organization and the project, so a workspace with sessions in it is
 * still refused, as before.
 *
 * Swapping the action needs the constraint dropped and added again; nothing
 * is deployed, so it is done in place (`database-design.md`).
 */
export class CascadeProjectsWithOrganization1791001500000 implements MigrationInterface {
  name = 'CascadeProjectsWithOrganization1791001500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.replace(queryRunner, 'CASCADE');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.replace(queryRunner, 'RESTRICT');
  }

  private async replace(queryRunner: QueryRunner, action: 'CASCADE' | 'RESTRICT'): Promise<void> {
    await queryRunner.query(`ALTER TABLE project DROP CONSTRAINT "FK_project_organization"`);
    await queryRunner.query(
      `ALTER TABLE project ADD CONSTRAINT "FK_project_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE ${action}`,
    );
  }
}
