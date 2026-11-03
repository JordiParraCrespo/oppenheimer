import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A bot follows a pull request on GitHub and is woken by what happens to it
 * (`product/versions/mvp/27-bot-subscriptions.md` §7, "As built"), beside
 * the sessions it follows.
 *
 * - `"resourceKind"` gains `pull_request`. A pull request is not ours and
 *   has no uuid here, so `"resourceId"` becomes nullable: a session's id for
 *   a session, null for a pull request. The pull request is named by
 *   GitHub's repository id and its number, `"githubRepoId"` (`bigint`, as
 *   every other table holds it) and `"pullNumber"`, plus
 *   `"repositoryFullName"`, the `owner/name` it had when the bot watched it,
 *   which its list and its wakes show. A rename on GitHub keeps the id, so
 *   the wake still finds the row; only the name shown is the old one.
 * - `CHK_bot_subscription_subject` ties the columns to the kind: a session
 *   names a session and nothing else; a pull request names a repository, a
 *   number from 1 and a name, no session, and follows it `until` `closed`
 *   with no task and no terminal watch. Each branch is a conjunction of
 *   `IS NOT NULL`/`IS NULL` tests, so no NULL slips through a CHECK.
 * - No foreign key: the pull request lives on GitHub. The wake re-resolves
 *   the bot and its owner, so one whose bot is gone or whose owner left ends
 *   there; a merge ends it after its wake.
 *
 * Access patterns:
 * - the webhook's read: the subscriptions to one pull request in the event's
 *   workspace, `IDX_bot_subscription_pull_request`, partial on the kind so
 *   session rows cost it nothing;
 * - watch (an upsert) and unwatch: by bot and pull request,
 *   `UQ_bot_subscription_bot_pull_request`, partial on the kind, which also
 *   makes a bot hold one subscription per pull request, as it holds one per
 *   session (`UQ_bot_subscription_bot_resource`, where a null
 *   `"resourceId"` never collides);
 * - a bot's list and its count: `UQ_bot_subscription_bot_resource`'s leading
 *   `("organizationId", "botId")`, unchanged.
 *
 * Both indexes are built on a table of a few rows per bot.
 */
export class AddBotPullRequestSubscriptions1793707588046 implements MigrationInterface {
  name = 'AddBotPullRequestSubscriptions1793707588046';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bot_subscription
        ALTER COLUMN "resourceId" DROP NOT NULL,
        ADD COLUMN "githubRepoId" bigint,
        ADD COLUMN "pullNumber" integer,
        ADD COLUMN "repositoryFullName" varchar(140),
        DROP CONSTRAINT "CHK_bot_subscription_resource_kind",
        ADD CONSTRAINT "CHK_bot_subscription_resource_kind" CHECK ("resourceKind" IN ('session', 'pull_request')),
        ADD CONSTRAINT "CHK_bot_subscription_subject" CHECK (
          ("resourceKind" = 'session'
            AND "resourceId" IS NOT NULL
            AND num_nonnulls("githubRepoId", "pullNumber", "repositoryFullName") = 0)
          OR ("resourceKind" = 'pull_request'
            AND "resourceId" IS NULL
            AND "githubRepoId" IS NOT NULL AND "githubRepoId" > 0
            AND "pullNumber" IS NOT NULL AND "pullNumber" >= 1
            AND "repositoryFullName" IS NOT NULL AND char_length("repositoryFullName") > 0
            AND "until" = 'closed'
            AND "terminalWatchId" IS NULL)
        )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bot_subscription_bot_pull_request" ON bot_subscription ("organizationId", "botId", "githubRepoId", "pullNumber") WHERE "resourceKind" = 'pull_request'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_subscription_pull_request" ON bot_subscription ("organizationId", "githubRepoId", "pullNumber") WHERE "resourceKind" = 'pull_request'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // A pull request has no session to fall back to: its subscriptions go.
    await queryRunner.query(`DELETE FROM bot_subscription WHERE "resourceKind" = 'pull_request'`);
    await queryRunner.query(`DROP INDEX "IDX_bot_subscription_pull_request"`);
    await queryRunner.query(`DROP INDEX "UQ_bot_subscription_bot_pull_request"`);
    await queryRunner.query(`
      ALTER TABLE bot_subscription
        DROP CONSTRAINT "CHK_bot_subscription_subject",
        DROP CONSTRAINT "CHK_bot_subscription_resource_kind",
        ADD CONSTRAINT "CHK_bot_subscription_resource_kind" CHECK ("resourceKind" IN ('session')),
        DROP COLUMN "repositoryFullName",
        DROP COLUMN "pullNumber",
        DROP COLUMN "githubRepoId",
        ALTER COLUMN "resourceId" SET NOT NULL
    `);
  }
}
