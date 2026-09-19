import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sessions, their checkouts and their append-only log
 * (`product/versions/mvp/03-control-plane.md`, `product/11-workspace-layout.md`).
 *
 * The constraints are the design, so each one is here on purpose:
 *
 *  - **Cross-tenant references are unrepresentable, not merely unchecked.**
 *    `(organizationId, projectId) → project (organizationId, id)` means a session
 *    cannot sit in another workspace's project whatever a handler forgets, and
 *    `(organizationId, installationId) → github_installation (organizationId, id)`
 *    means a checkout cannot be made through another workspace's GitHub
 *    installation. The `(organizationId, id)` unique on `project` is added **here**
 *    rather than by the projects migration: a constraint for a table that is not in
 *    the tree yet is speculative schema.
 *  - **`hostId` is a plain foreign key, `ON DELETE RESTRICT`.** A host belongs to a
 *    person and carries no workspace column, and a grant is a row rather than a
 *    column, so there is nothing for a composite key to reference; the create
 *    handler loads the host through the own-or-grant-scoped repository instead. The
 *    `RESTRICT` is what stops a host with sessions on it being unpaired out from
 *    under them.
 *  - **`(id, cwdCheckoutId) → session_checkout (sessionId, id)`**, in the
 *    column-list `ON DELETE SET NULL ("cwdCheckoutId")` form, so naming another
 *    session's checkout as the agent's working directory is unrepresentable. The
 *    column list is Postgres 15+; without it Postgres nulls *every* column of the
 *    constraint, `id` included, and the statement fails on the primary key. It is
 *    also `DEFERRABLE INITIALLY DEFERRED`, because a create inserts the session
 *    before the checkout it points at. In practice the clause never fires: checkout
 *    rows are not deleted, and the remove-checkout command nulls the column itself.
 *  - **Nothing is ever hard-deleted.** `work_session` rows stay for ever, so
 *    `uq (projectId, slug)` is a permanent tombstone for a directory name — the
 *    coding agents key their conversation state by working directory, so a new
 *    session on a retired name would inherit a stranger's history. `session_checkout`
 *    has `removedAt` for the same reason, with the repository unique made partial so
 *    a repository may be re-added while the directory name it used never is.
 *  - **The log is dense and idempotent.** `uq (sessionId, seq)` with `seq` assigned
 *    by the control plane under a row lock, and `uq (sessionId, idempotencyKey)` so
 *    a batch replayed after a dropped acknowledgement appends only what was not yet
 *    seen. `work_session_event` has no `organizationId`: it is only ever read through
 *    its session.
 */
export class AddSessions1789100000000 implements MigrationInterface {
  name = 'AddSessions1789100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The key the sessions composite foreign key needs. Deliberately left to this
    // migration by `AddProjects`, which had nothing to reference it.
    await queryRunner.query(
      `ALTER TABLE "project"
         ADD CONSTRAINT "UQ_project_organization_id" UNIQUE ("organizationId", "id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "work_session" (
        "id"              uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId"  uuid NOT NULL,
        "projectId"       uuid NOT NULL,
        "createdByUserId" uuid NOT NULL,
        "hostId"          uuid NOT NULL,
        "name"            character varying NOT NULL,
        "nameSource"      character varying,
        "slug"            character varying NOT NULL,
        "agent"           character varying NOT NULL,
        "cwdCheckoutId"   uuid,
        "idempotencyKey"  character varying,
        "state"           character varying NOT NULL DEFAULT 'starting',
        "stateSeq"        integer NOT NULL DEFAULT 0,
        "agentSessionId"  character varying,
        "lastEventAt"     TIMESTAMP,
        "stoppedAt"       TIMESTAMP,
        "createdAt"       TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"       TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_work_session" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_work_session_project_slug" UNIQUE ("projectId", "slug"),
        CONSTRAINT "UQ_work_session_organization_id" UNIQUE ("organizationId", "id"),
        CONSTRAINT "CHK_work_session_state"
          CHECK ("state" IN ('starting', 'open', 'failed', 'resolved')),
        CONSTRAINT "FK_work_session_organization"
          FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_work_session_project"
          FOREIGN KEY ("organizationId", "projectId") REFERENCES "project"("organizationId", "id")
          ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_work_session_host"
          FOREIGN KEY ("hostId") REFERENCES "host"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_work_session_created_by"
          FOREIGN KEY ("createdByUserId") REFERENCES "user"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "session_checkout" (
        "id"                  uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId"      uuid NOT NULL,
        "sessionId"           uuid NOT NULL,
        "installationId"      uuid NOT NULL,
        "githubRepoId"        bigint NOT NULL,
        "repositoryFullName"  character varying NOT NULL,
        "storeDirectoryName"  character varying,
        "directoryName"       character varying NOT NULL,
        "mode"                character varying NOT NULL DEFAULT 'worktree',
        "baseBranch"          character varying NOT NULL,
        "branch"              character varying NOT NULL,
        "worktreeCreatedAt"   TIMESTAMP,
        "pushedAt"            TIMESTAMP,
        "removedAt"           TIMESTAMP,
        "createdAt"           TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_session_checkout" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_session_checkout_session_id" UNIQUE ("sessionId", "id"),
        CONSTRAINT "UQ_session_checkout_session_directory" UNIQUE ("sessionId", "directoryName"),
        CONSTRAINT "CHK_session_checkout_mode" CHECK ("mode" IN ('worktree', 'clone')),
        CONSTRAINT "FK_session_checkout_session"
          FOREIGN KEY ("organizationId", "sessionId")
          REFERENCES "work_session"("organizationId", "id")
          ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_session_checkout_installation"
          FOREIGN KEY ("organizationId", "installationId")
          REFERENCES "github_installation"("organizationId", "id")
          ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "work_session_event" (
        "id"             uuid NOT NULL DEFAULT gen_random_uuid(),
        "sessionId"      uuid NOT NULL,
        "seq"            integer NOT NULL,
        "idempotencyKey" character varying NOT NULL,
        "source"         character varying NOT NULL,
        "kind"           character varying NOT NULL,
        "payload"        jsonb NOT NULL DEFAULT '{}'::jsonb,
        "occurredAt"     TIMESTAMP NOT NULL,
        "recordedAt"     TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_work_session_event" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_work_session_event_session_key" UNIQUE ("sessionId", "idempotencyKey"),
        CONSTRAINT "CHK_work_session_event_source" CHECK ("source" IN ('runner', 'api')),
        CONSTRAINT "FK_work_session_event_session"
          FOREIGN KEY ("sessionId") REFERENCES "work_session"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);

    // Added after `session_checkout` exists, and deferrable: a create inserts the
    // session, then its checkouts, then points the session at one of them, all in
    // one transaction.
    await queryRunner.query(`
      ALTER TABLE "work_session"
        ADD CONSTRAINT "FK_work_session_cwd_checkout"
        FOREIGN KEY ("id", "cwdCheckoutId") REFERENCES "session_checkout"("sessionId", "id")
        ON DELETE SET NULL ("cwdCheckoutId") ON UPDATE NO ACTION
        DEFERRABLE INITIALLY DEFERRED
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_work_session_organization_state"
         ON "work_session" ("organizationId", "state", "createdAt" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_work_session_project_state" ON "work_session" ("projectId", "state")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_work_session_host_state" ON "work_session" ("hostId", "state")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_work_session_organization_idempotency"
         ON "work_session" ("organizationId", "idempotencyKey")
       WHERE "idempotencyKey" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_session_checkout_session" ON "session_checkout" ("sessionId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_session_checkout_session_repo"
         ON "session_checkout" ("sessionId", "githubRepoId")
       WHERE "removedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_work_session_event_session_seq"
         ON "work_session_event" ("sessionId", "seq")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_work_session_event_session_seq"`);
    await queryRunner.query(`DROP INDEX "UQ_session_checkout_session_repo"`);
    await queryRunner.query(`DROP INDEX "IDX_session_checkout_session"`);
    await queryRunner.query(`DROP INDEX "UQ_work_session_organization_idempotency"`);
    await queryRunner.query(`DROP INDEX "IDX_work_session_host_state"`);
    await queryRunner.query(`DROP INDEX "IDX_work_session_project_state"`);
    await queryRunner.query(`DROP INDEX "IDX_work_session_organization_state"`);
    await queryRunner.query(
      `ALTER TABLE "work_session" DROP CONSTRAINT "FK_work_session_cwd_checkout"`,
    );
    await queryRunner.query(`DROP TABLE "work_session_event"`);
    await queryRunner.query(`DROP TABLE "session_checkout"`);
    await queryRunner.query(`DROP TABLE "work_session"`);
    await queryRunner.query(`ALTER TABLE "project" DROP CONSTRAINT "UQ_project_organization_id"`);
  }
}
