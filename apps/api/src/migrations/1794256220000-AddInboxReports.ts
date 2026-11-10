import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A report sent to a workspace's Inbox (`product/versions/mvp/29-inbox.md`,
 * "Reports"): a problem an unattended agent found, with its pictures, that
 * the owner answers in the Inbox and the agent reads back. It is the one
 * Inbox item with a table, because no other source knows it.
 *
 * - A report is the workspace's, not a person's, so it carries no owner:
 *   `"createdByUserId"` is whose credential sent it and `"answeredByUserId"`
 *   who answered, both `SET NULL` when that account goes, since the report
 *   and its answer stay. The workspace cascades.
 * - `images` is a jsonb list of `{id, storageKey, mimeType, sizeBytes, name}`,
 *   at most four, always read whole with the report and never filtered on.
 *   The bytes are in the deployment's storage under
 *   `inbox-reports/<organizationId>/<reportId>/<imageId>.<ext>`. No table of
 *   their own: a picture has no life apart from its report.
 * - One answer, given once: `CHK_inbox_report_answer` holds `status`,
 *   `answer` and `"answeredAt"` together, and the write that answers is
 *   guarded on `status = 'open'`, so two answers at once leave the first.
 * - The lengths mirror `packages/shared/src/schemas/inbox.schema.ts`.
 *
 * Access patterns:
 *   Q1 a workspace's reports by status, newest first (GET list)
 *        → IDX_inbox_report_org_status_created, scanned backwards
 *   Q2 one report by id in its workspace (GET one, a picture, the answer)
 *        → PK_inbox_report, the workspace checked on the row
 *   Q3 a user's delete setting the two links null
 *        → IDX_inbox_report_created_by, IDX_inbox_report_answered_by
 *
 * Retention: a report is kept after it is answered, with its pictures
 * (29, "Reports" §4); nothing deletes one yet. Deleting a workspace removes
 * its rows and leaves their files in storage, as it does a bot's images.
 */
export class AddInboxReports1794256220000 implements MigrationInterface {
  name = 'AddInboxReports1794256220000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE inbox_report (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "createdByUserId" uuid,
        title varchar(200) NOT NULL,
        body text NOT NULL DEFAULT '',
        source varchar(80) NOT NULL DEFAULT '',
        link varchar(2000),
        images jsonb NOT NULL DEFAULT '[]',
        status varchar(16) NOT NULL DEFAULT 'open',
        answer text,
        "answeredByUserId" uuid,
        "answeredAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inbox_report" PRIMARY KEY (id),
        CONSTRAINT "CHK_inbox_report_status" CHECK (status IN ('open', 'answered')),
        CONSTRAINT "CHK_inbox_report_title" CHECK (char_length(title) > 0),
        CONSTRAINT "CHK_inbox_report_body" CHECK (char_length(body) <= 4000),
        CONSTRAINT "CHK_inbox_report_link" CHECK (link IS NULL OR char_length(link) > 0),
        CONSTRAINT "CHK_inbox_report_images" CHECK (jsonb_typeof(images) = 'array' AND jsonb_array_length(images) <= 4),
        CONSTRAINT "CHK_inbox_report_answer" CHECK ((status = 'answered') = (answer IS NOT NULL) AND (status = 'answered') = ("answeredAt" IS NOT NULL) AND (answer IS NULL OR char_length(answer) BETWEEN 1 AND 2000) AND ("answeredAt" IS NULL OR isfinite("answeredAt"))),
        CONSTRAINT "FK_inbox_report_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE,
        CONSTRAINT "FK_inbox_report_created_by" FOREIGN KEY ("createdByUserId") REFERENCES "user"(id) ON DELETE SET NULL,
        CONSTRAINT "FK_inbox_report_answered_by" FOREIGN KEY ("answeredByUserId") REFERENCES "user"(id) ON DELETE SET NULL
      )
    `);
    // Q1; also backs FK_inbox_report_organization.
    await queryRunner.query(
      `CREATE INDEX "IDX_inbox_report_org_status_created" ON inbox_report ("organizationId", status, "createdAt")`,
    );
    // Q3: back the two foreign keys to "user".
    await queryRunner.query(
      `CREATE INDEX "IDX_inbox_report_created_by" ON inbox_report ("createdByUserId") WHERE "createdByUserId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inbox_report_answered_by" ON inbox_report ("answeredByUserId") WHERE "answeredByUserId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_inbox_report_answered_by"`);
    await queryRunner.query(`DROP INDEX "IDX_inbox_report_created_by"`);
    await queryRunner.query(`DROP INDEX "IDX_inbox_report_org_status_created"`);
    await queryRunner.query(`DROP TABLE inbox_report`);
  }
}
