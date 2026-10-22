import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A bot hears back from the work it delegated
 * (`product/versions/mvp/27-bot-subscriptions.md`, issue #445).
 *
 * - `bot_subscription`: this bot follows this resource (a session today)
 *   for this reason, since this turn of its own. A wake is not stored here:
 *   it is a queued `bot_turn` whose `"sourceKey"` names the subscription,
 *   the task and its state, so the turn queue stays the one durable record
 *   of a wake (26 §1) and `UQ_bot_turn_source` makes a wake delivered twice
 *   one turn. `"lastTurn"`/`"lastState"` are the newest wake recorded, a
 *   fast filter for a late event; `"wakes"` counts them against the limit.
 * - `"resourceId"` has no foreign key: it is polymorphic over
 *   `"resourceKind"` (a session now; an automation run or a pull request
 *   later, 27 §7), and the wake re-reads the resource as the owner, so one
 *   that is gone ends the subscription there. Sessions are tombstoned,
 *   never deleted, except with their workspace, which cascades here too.
 * - `"originTurnId"` is the bot's turn that subscribed, the correlation a
 *   wake carries; `SET NULL` when the chat is cleared, since the
 *   subscription outlives the conversation that made it.
 * - An ended subscription is deleted, not kept with a status: nothing reads
 *   it afterwards, so there is no retention to plan. A subscription that
 *   ends by itself (its task ended, the session closed, the owner lost
 *   access, the wake limit) is deleted by the wake that ended it.
 * - `"version"` guards the wake's record against a second wake of the same
 *   subscription written meanwhile.
 *
 * Access patterns:
 * - the wake: a session's subscriptions in the event's workspace,
 *   `IDX_bot_subscription_resource`;
 * - subscribe (an upsert), unwatch, and a bot's list: by bot and resource,
 *   `UQ_bot_subscription_bot_resource`, which also backs the bot foreign key;
 * - clearing a chat: `IDX_bot_subscription_origin_turn` backs that key.
 */
export class AddBotSubscriptions1791003300000 implements MigrationInterface {
  name = 'AddBotSubscriptions1791003300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE bot_subscription (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "botId" uuid NOT NULL,
        "resourceKind" varchar(32) NOT NULL,
        "resourceId" uuid NOT NULL,
        "originTurnId" uuid,
        purpose varchar(500),
        "until" varchar(16) NOT NULL DEFAULT 'task',
        "watchedTurn" integer,
        "credentialScopes" jsonb,
        "timeZone" varchar(64),
        "lastTurn" integer,
        "lastState" varchar(16),
        wakes integer NOT NULL DEFAULT 0,
        version integer NOT NULL DEFAULT 1,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bot_subscription" PRIMARY KEY (id),
        CONSTRAINT "CHK_bot_subscription_resource_kind" CHECK ("resourceKind" IN ('session')),
        CONSTRAINT "CHK_bot_subscription_until" CHECK ("until" IN ('task', 'closed')),
        CONSTRAINT "CHK_bot_subscription_watched_turn" CHECK (("until" = 'task') = ("watchedTurn" IS NOT NULL) AND ("watchedTurn" IS NULL OR "watchedTurn" >= 1)),
        CONSTRAINT "CHK_bot_subscription_purpose" CHECK (purpose IS NULL OR char_length(purpose) > 0),
        CONSTRAINT "CHK_bot_subscription_credential_scopes" CHECK ("credentialScopes" IS NULL OR jsonb_typeof("credentialScopes") = 'array'),
        CONSTRAINT "CHK_bot_subscription_last" CHECK (num_nonnulls("lastTurn", "lastState") <> 1 AND ("lastState" IS NULL OR "lastState" IN ('requires_action', 'completed', 'failed', 'cancelled', 'expired'))),
        CONSTRAINT "CHK_bot_subscription_wakes" CHECK (wakes >= 0),
        CONSTRAINT "CHK_bot_subscription_version" CHECK (version >= 1)
      )
    `);
    await queryRunner.query(
      `ALTER TABLE bot_subscription ADD CONSTRAINT "FK_bot_subscription_bot" FOREIGN KEY ("organizationId", "botId") REFERENCES bot("organizationId", id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_subscription ADD CONSTRAINT "FK_bot_subscription_origin_turn" FOREIGN KEY ("organizationId", "originTurnId") REFERENCES bot_turn("organizationId", id) ON DELETE SET NULL ("originTurnId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bot_subscription_bot_resource" ON bot_subscription ("organizationId", "botId", "resourceKind", "resourceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_subscription_resource" ON bot_subscription ("organizationId", "resourceKind", "resourceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_subscription_origin_turn" ON bot_subscription ("organizationId", "originTurnId") WHERE "originTurnId" IS NOT NULL`,
    );

    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "CHK_bot_turn_origin"`);
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "CHK_bot_turn_origin" CHECK (origin IN ('message', 'approval', 'routine', 'subscription'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // A wake's turn stays, as a routine's would: it ran for the bot.
    await queryRunner.query(`UPDATE bot_turn SET origin = 'routine' WHERE origin = 'subscription'`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "CHK_bot_turn_origin"`);
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "CHK_bot_turn_origin" CHECK (origin IN ('message', 'approval', 'routine'))`,
    );
    await queryRunner.query(`DROP TABLE bot_subscription`);
  }
}
