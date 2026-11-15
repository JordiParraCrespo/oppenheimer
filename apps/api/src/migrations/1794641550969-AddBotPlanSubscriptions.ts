import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A bot follows the tasks of a project, or of one milestone, and is woken by
 * the changes it names (`product/versions/mvp/27-bot-subscriptions.md` §7.2),
 * beside the sessions and pull requests it follows.
 *
 * - `"resourceKind"` gains `project` and `milestone`; `"resourceId"` names
 *   the project or the milestone, as it names a session. Two kinds rather
 *   than one with a milestone column, so `UQ_bot_subscription_bot_resource`
 *   keeps a bot to one subscription per project and one per milestone, and
 *   the wake's read stays `IDX_bot_subscription_resource`.
 * - `"taskEvents"` is the list of Plan's task changes (`plan_event."kind"`)
 *   that wake the bot: a `jsonb` array read whole, never filtered on.
 *   Required for the two new kinds, absent for the others. Which kinds it may
 *   hold is the application's (`BOT_TASK_WAKE_EVENTS`), as `plan_event`'s
 *   own CHECK is built from the same list.
 * - `CHK_bot_subscription_subject` gains the branch: a project or a
 *   milestone names its id, no pull request, at least one change, and is
 *   followed `until` `closed` with no terminal watch. The session and pull
 *   request branches now also require no `"taskEvents"`.
 * - No foreign key, as for a session: `"resourceId"` is polymorphic over the
 *   kind. The wake reads the project or the milestone as the bot's owner and
 *   ends the subscription when it cannot; a deleted milestone's
 *   subscriptions are deleted by the bots module when the milestone is.
 *
 * Access patterns:
 * - a logged change's read: the subscriptions to its project and to its
 *   milestone in the workspace, `IDX_bot_subscription_resource`
 *   (`"organizationId"`, `"resourceKind"`, `"resourceId"`), unchanged;
 * - watch (an upsert) and unwatch: `UQ_bot_subscription_bot_resource`,
 *   unchanged;
 * - a bot's list and its count: that unique's leading
 *   (`"organizationId"`, `"botId"`), unchanged.
 */
export class AddBotPlanSubscriptions1794641550969 implements MigrationInterface {
  name = 'AddBotPlanSubscriptions1794641550969';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bot_subscription
        ADD COLUMN "taskEvents" jsonb,
        DROP CONSTRAINT "CHK_bot_subscription_resource_kind",
        ADD CONSTRAINT "CHK_bot_subscription_resource_kind" CHECK ("resourceKind" IN ('session', 'pull_request', 'project', 'milestone')),
        DROP CONSTRAINT "CHK_bot_subscription_subject",
        ADD CONSTRAINT "CHK_bot_subscription_subject" CHECK (
          ("resourceKind" = 'session'
            AND "resourceId" IS NOT NULL
            AND num_nonnulls("githubRepoId", "pullNumber", "repositoryFullName", "taskEvents") = 0)
          OR ("resourceKind" = 'pull_request'
            AND "resourceId" IS NULL
            AND "githubRepoId" IS NOT NULL AND "githubRepoId" > 0
            AND "pullNumber" IS NOT NULL AND "pullNumber" >= 1
            AND "repositoryFullName" IS NOT NULL AND char_length("repositoryFullName") > 0
            AND "taskEvents" IS NULL
            AND "until" = 'closed'
            AND "terminalWatchId" IS NULL)
          OR ("resourceKind" IN ('project', 'milestone')
            AND "resourceId" IS NOT NULL
            AND num_nonnulls("githubRepoId", "pullNumber", "repositoryFullName") = 0
            AND "taskEvents" IS NOT NULL
            AND jsonb_typeof("taskEvents") = 'array'
            AND jsonb_array_length("taskEvents") > 0
            AND "until" = 'closed'
            AND "terminalWatchId" IS NULL)
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // A project or a milestone has no session to fall back to: those go.
    await queryRunner.query(
      `DELETE FROM bot_subscription WHERE "resourceKind" IN ('project', 'milestone')`,
    );
    await queryRunner.query(`
      ALTER TABLE bot_subscription
        DROP CONSTRAINT "CHK_bot_subscription_subject",
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
        ),
        DROP COLUMN "taskEvents"
    `);
  }
}
