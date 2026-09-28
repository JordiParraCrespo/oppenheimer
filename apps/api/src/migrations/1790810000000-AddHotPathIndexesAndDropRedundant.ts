import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indexes the automation and session queries that run on every tick, dispatch
 * and runner hello, backs two foreign keys that had no index, and drops two
 * indexes no query reads. No query changes here: every statement below serves
 * a query that already runs as written.
 *
 * Access patterns and what serves each:
 *   Q1a live dispatched runs past their limit, oldest first, every minute
 *       (`AutomationRunRepository.findLiveDispatchedBefore`, no organization)
 *                                                → IDX_automation_run_dispatched
 *   Q1b live runs on a host, twice per dispatch (`countLive` by host)
 *                                                → IDX_automation_run_dispatched
 *   Q1c live runs of an automation (`countLive` by automation)
 *                                                → IDX_automation_run_dispatched
 *   Q2  an automation's triggers by `automationId` alone (`assemble`), and the
 *       delete of the triggers a save dropped (`writeTriggers`)
 *                                                → IDX_automation_trigger_automation
 *   Q3  the first prompt of each unresolved session on hello
 *       (`findUnresolvedForHostForMachine`)      → IDX_work_session_event_first_prompt
 *   Q4  the RESTRICT checks of a `user` delete and a GitHub installation delete
 *                                                → IDX_work_session_created_by,
 *                                                  IDX_session_checkout_installation
 *   Q5  the nightly retention purge of runs by `createdAt`
 *                                                → IDX_automation_run_created_brin
 *   Q6  nothing: IDX_session_checkout_session and IDX_work_session_organization_state
 *       are dropped
 *
 * Q1. Partial on `outcome = 'dispatched'`, so the index holds only dispatched
 * runs and the live window is a short range at its end: `< $before ORDER BY
 * dispatchedAt` for Q1a, `>= $since` for Q1b and Q1c. It adds no non-HOT
 * update: `outcome` is already in IDX_automation_run_pending's predicate, so
 * the `pending → dispatched` write was non-HOT before this, and the dispatcher
 * does not update a dispatched run again. An `("automationId", "dispatchedAt")`
 * variant for Q1c is not added: once Q1a is bounded from below, all three read
 * only the live window.
 *
 * Q2. IDX_automation_trigger_automation was `("organizationId", "automationId",
 * "position")`, and the aggregate's reads and writes give `automationId` alone,
 * which a B-tree led by `organizationId` cannot serve. It is rebuilt as
 * `("automationId", "organizationId", "position")` under the same name (its
 * purpose is unchanged). Both columns of FK_automation_trigger_automation still
 * lead, so the cascade from `automation` stays served by it. Keeping the old
 * index and adding `("automationId")` was rejected: two indexes over one key,
 * one of which nothing reads.
 *
 * Q3. `'prompt.first'` is `SESSION_EVENT_KINDS.PROMPT_FIRST`
 * (`sessions/domain/session-state.policy.ts`). Renaming that kind needs a
 * migration that rebuilds this index. Each session has at most one such row,
 * so the index is tiny and no other kind of event maintains it.
 *
 * Q4. `work_session."createdByUserId"` (FK_work_session_created_by, RESTRICT)
 * and `session_checkout ("organizationId", "installationId")`
 * (FK_session_checkout_installation, RESTRICT) had no index, so a user delete
 * and a GitHub uninstall scanned those tables under lock.
 *
 * Q5. `1790600000000-AddAutomations` says the purge goes through
 * IDX_automation_run_organization_created. It does not: that index leads with
 * `organizationId` and the purge gives none, so every batch's InitPlan was a
 * sequential scan. This BRIN serves it, as `inbound_event` and `host_event`
 * are purged. BRIN is declared on the entity with `synchronize: false`.
 *
 * Q6. IDX_session_checkout_session `("sessionId")` is a prefix of
 * UQ_session_checkout_session_id and UQ_session_checkout_session_directory.
 * IDX_work_session_organization_state `("organizationId", "state", "createdAt"
 * DESC)` serves no query: the sessions list sorts by `COALESCE("lastEventAt",
 * "createdAt")`, by name, or by `createdAt, id`, which it cannot give either;
 * `organizationId` alone is served by UQ_work_session_organization_slug and
 * UQ_work_session_organization_id. Dropping it also makes a fold that moves
 * `state` one index cheaper (IDX_work_session_project_state and
 * IDX_work_session_host_state still hold `state`, on purpose).
 *
 * Foreign keys whose index leads with some, not all, of their columns, which
 * the rule allows when it is written down (`apps/api/test/schema.integration.spec.ts`
 * holds the list):
 *   FK_session_checkout_session ("organizationId", "sessionId")
 *       → UQ_session_checkout_session_id ("sessionId", "id"). `sessionId` is a
 *         uuid, unique across workspaces, so `organizationId` adds nothing to
 *         the lookup a `work_session` delete makes.
 *   FK_work_session_project ("organizationId", "projectId")
 *       → IDX_work_session_project_state ("projectId", "state"), for the same
 *         reason. Pre-existing; left as it is.
 *
 * Partitioning `work_session_event` and `automation_run` by time is the next
 * step if they outgrow this; it is not needed yet.
 *
 * `down()` restores the pre-migration index set exactly, including `"createdAt"
 * DESC` on IDX_work_session_organization_state and the old column order of
 * IDX_automation_trigger_automation.
 *
 * ---------------------------------------------------------------------------
 * Large databases (a table over 100k rows or 128 MB): run the ops script.
 *
 * Boot migrations share one transaction and hold every lock until it commits.
 * `CREATE INDEX` blocks writes to its table and `DROP INDEX` blocks reads too,
 * for the whole deploy. `work_session_event` grows without bound, and
 * `automation_run`, `work_session` and `session_checkout` can be large. So on a
 * large table this migration only checks that the work is done, and fails with
 * a pointer here if it is not. Before deploying, run with psql in autocommit
 * mode `apps/api/db/ops/1790810000000-hot-path-indexes.sql`; before reverting,
 * `apps/api/db/ops/1790810000000-hot-path-indexes.rollback.sql`. Both can be
 * re-run. On small databases (development, CI, fresh installs) the migration
 * does all of it itself.
 * ---------------------------------------------------------------------------
 */

const OPS = 'apps/api/db/ops/1790810000000-hot-path-indexes.sql';
const ROLLBACK = 'apps/api/db/ops/1790810000000-hot-path-indexes.rollback.sql';

/**
 * [table, name, definition, what `pg_get_indexdef` ends with]. The last is how
 * a rebuilt index is told apart from the one it replaces under the same name.
 */
type IndexSpec = [string, string, string, string];

const TRIGGER_BY_AUTOMATION: IndexSpec = [
  'automation_trigger',
  'IDX_automation_trigger_automation',
  `("automationId", "organizationId", "position")`,
  `USING btree ("automationId", "organizationId", "position")`,
];
const TRIGGER_BY_AUTOMATION_BEFORE: IndexSpec = [
  'automation_trigger',
  'IDX_automation_trigger_automation',
  `("organizationId", "automationId", "position")`,
  `USING btree ("organizationId", "automationId", "position")`,
];

/** What `up()` creates, or rebuilds under the same name. */
const CREATED: IndexSpec[] = [
  // Q1
  [
    'automation_run',
    'IDX_automation_run_dispatched',
    `("dispatchedAt") WHERE "outcome" = 'dispatched'`,
    `USING btree ("dispatchedAt") WHERE ((outcome)::text = 'dispatched'::text)`,
  ],
  // Q2
  TRIGGER_BY_AUTOMATION,
  // Q3
  [
    'work_session_event',
    'IDX_work_session_event_first_prompt',
    `("sessionId") WHERE "kind" = 'prompt.first'`,
    `USING btree ("sessionId") WHERE ((kind)::text = 'prompt.first'::text)`,
  ],
  // Q4
  [
    'work_session',
    'IDX_work_session_created_by',
    `("createdByUserId")`,
    `USING btree ("createdByUserId")`,
  ],
  [
    'session_checkout',
    'IDX_session_checkout_installation',
    `("organizationId", "installationId")`,
    `USING btree ("organizationId", "installationId")`,
  ],
  // Q5
  [
    'automation_run',
    'IDX_automation_run_created_brin',
    `USING brin ("createdAt")`,
    `USING brin ("createdAt")`,
  ],
];

/** What `up()` drops (Q6), with the definition `down()` puts back. */
const DROPPED: IndexSpec[] = [
  [
    'session_checkout',
    'IDX_session_checkout_session',
    `("sessionId")`,
    `USING btree ("sessionId")`,
  ],
  [
    'work_session',
    'IDX_work_session_organization_state',
    `("organizationId", "state", "createdAt" DESC)`,
    `USING btree ("organizationId", state, "createdAt" DESC)`,
  ],
];

export class AddHotPathIndexesAndDropRedundant1790810000000 implements MigrationInterface {
  name = 'AddHotPathIndexesAndDropRedundant1790810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '5s'`);
    for (const spec of CREATED) {
      await this.ensureIndex(queryRunner, spec, OPS);
    }
    for (const [table, name] of DROPPED) {
      await this.ensureNoIndex(queryRunner, table, name, OPS);
    }
    await queryRunner.query(`RESET lock_timeout`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '5s'`);
    for (const spec of [...DROPPED].reverse()) {
      await this.ensureIndex(queryRunner, spec, ROLLBACK);
    }
    for (const spec of [...CREATED].reverse()) {
      if (spec === TRIGGER_BY_AUTOMATION) {
        await this.ensureIndex(queryRunner, TRIGGER_BY_AUTOMATION_BEFORE, ROLLBACK);
      } else {
        await this.ensureNoIndex(queryRunner, spec[0], spec[1], ROLLBACK);
      }
    }
    await queryRunner.query(`RESET lock_timeout`);
  }

  /** True when a table is too big to build or drop an index on it inside the boot transaction. */
  private async isLarge(queryRunner: QueryRunner, table: string): Promise<boolean> {
    const [row] = await queryRunner.query(
      `SELECT c.reltuples > 100000 OR pg_total_relation_size(c.oid) > 128 * 1024 * 1024 AS large
         FROM pg_class c WHERE c.oid = $1::regclass`,
      [`"${table}"`],
    );
    return row.large === true;
  }

  /**
   * Valid with the wanted definition, valid with another one (the index it
   * replaces), invalid (an interrupted concurrent build) or missing.
   */
  private async indexState(queryRunner: QueryRunner, name: string, definition: string) {
    const [row] = await queryRunner.query(
      `SELECT i.indisvalid AS valid, pg_get_indexdef(i.indexrelid) AS definition
         FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
        WHERE c.relname = $1 AND c.relnamespace = 'public'::regnamespace`,
      [name],
    );
    if (!row) return 'missing';
    if (!row.valid) return 'invalid';
    return (row.definition as string).endsWith(definition) ? 'valid' : 'outdated';
  }

  private async refuseIfLarge(queryRunner: QueryRunner, table: string, what: string, ops: string) {
    if (await this.isLarge(queryRunner, table)) {
      throw new Error(
        `${what} and "${table}" is too large to change it at boot. Run ${ops} first (see this migration's header).`,
      );
    }
  }

  private async ensureIndex(
    queryRunner: QueryRunner,
    [table, name, definition, indexdef]: IndexSpec,
    ops: string,
  ) {
    const state = await this.indexState(queryRunner, name, indexdef);
    if (state === 'valid') return;
    await this.refuseIfLarge(queryRunner, table, `${name} is ${state}`, ops);
    if (state !== 'missing') await queryRunner.query(`DROP INDEX "${name}"`);
    await queryRunner.query(`CREATE INDEX "${name}" ON "${table}" ${definition}`);
  }

  private async ensureNoIndex(queryRunner: QueryRunner, table: string, name: string, ops: string) {
    const [row] = await queryRunner.query(
      `SELECT 1 FROM pg_class c WHERE c.relname = $1 AND c.relnamespace = 'public'::regnamespace`,
      [name],
    );
    if (!row) return;
    await this.refuseIfLarge(queryRunner, table, `${name} is still there`, ops);
    await queryRunner.query(`DROP INDEX IF EXISTS "${name}"`);
  }
}
