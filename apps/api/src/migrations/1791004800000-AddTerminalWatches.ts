import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Watches on what a session's terminal prints (`product/versions/mvp/27-bot-subscriptions.md`
 * §2; from Grok Bot's shell-output notifications,
 * `research/lessons-from-grok-bot.md` §9 row 8).
 *
 * - `session_terminal_watch`: one pattern a session's runner scans its screen
 *   for. The sessions module owns it because it is what the runner is told:
 *   `session.watch` when it is made, again on every hello (the runner keeps
 *   watches in memory), `session.unwatch` when it goes. A match comes back as
 *   a `terminal.matched` entry in the session's log carrying the watch and a
 *   count, never the text: pane text stays on the host. Bounded per session
 *   by the application (`SESSION_TERMINAL_WATCHES_MAX`), counted under a lock
 *   on the session row.
 *   - `(organizationId, sessionId) → work_session(organizationId, id)`,
 *     cascading: a watch means nothing without its session.
 * - `bot_subscription` gains the watch a bot asked for with its pattern:
 *   `terminalWatchId` (no foreign key: the watch is the sessions module's,
 *   and a subscription outliving it only stops matching), `pattern` as the
 *   bot wrote it, for its list and its wakes, and `matches`, the newest count
 *   a wake reported, so a watch that never matched can say so when its task
 *   ends.
 *
 * Access patterns: a session's watches (each hello, each unwatch) through
 * `IDX_session_terminal_watch_session`, which also backs the foreign key; a
 * match's subscription by its watch through `IDX_bot_subscription_terminal_watch`.
 */
export class AddTerminalWatches1791004800000 implements MigrationInterface {
  name = 'AddTerminalWatches1791004800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE session_terminal_watch (
        id uuid NOT NULL,
        "organizationId" uuid NOT NULL,
        "sessionId" uuid NOT NULL,
        "pattern" character varying(200) NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_session_terminal_watch" PRIMARY KEY (id),
        CONSTRAINT "CHK_session_terminal_watch_pattern" CHECK (char_length("pattern") > 0)
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_session_terminal_watch_session" ON session_terminal_watch ("organizationId", "sessionId")`,
    );
    await queryRunner.query(
      `ALTER TABLE session_terminal_watch ADD CONSTRAINT "FK_session_terminal_watch_session" FOREIGN KEY ("organizationId", "sessionId") REFERENCES work_session("organizationId", id) ON DELETE CASCADE`,
    );
    await queryRunner.query(`
      ALTER TABLE bot_subscription
        ADD COLUMN "terminalWatchId" uuid,
        ADD COLUMN "pattern" character varying(200),
        ADD COLUMN "matches" integer DEFAULT 0 NOT NULL,
        ADD CONSTRAINT "CHK_bot_subscription_pattern" CHECK (("terminalWatchId" IS NULL) = ("pattern" IS NULL)),
        ADD CONSTRAINT "CHK_bot_subscription_matches" CHECK ("matches" >= 0)
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_subscription_terminal_watch" ON bot_subscription ("terminalWatchId") WHERE ("terminalWatchId" IS NOT NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_bot_subscription_terminal_watch"`);
    await queryRunner.query(`
      ALTER TABLE bot_subscription
        DROP CONSTRAINT "CHK_bot_subscription_matches",
        DROP CONSTRAINT "CHK_bot_subscription_pattern",
        DROP COLUMN "matches",
        DROP COLUMN "pattern",
        DROP COLUMN "terminalWatchId"
    `);
    await queryRunner.query(`DROP TABLE session_terminal_watch`);
  }
}
