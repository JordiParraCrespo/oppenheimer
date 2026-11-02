import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What a bot may do, tool by tool, and the rules a reviewer reads before an
 * asking call (`product/versions/mvp/25-bots.md` §5; from Grok Bot's
 * approvals, `research/lessons-from-grok-bot.md` §9 rows 6 and 7).
 *
 * - `bot_tool_permission`: the owner's setting for one tool, where it
 *   differs from the catalog. A row with no subject is the tool's decision:
 *   `allow` runs it without asking, `ask` raises a card, `off` takes the tool
 *   away. A row with a subject is a standing grant for one thing
 *   (`subjectKind` `repository`, `session`, …, keyed by `subjectKey`, shown
 *   as `subjectLabel`): every call of the tool on that thing runs without
 *   asking, so it is only ever `allow`. A tool with no row follows the bot's
 *   preset; a tool added later reaches every bot with its own default.
 *   - `UQ_bot_tool_permission` is `NULLS NOT DISTINCT`, so a tool has one
 *     decision and one grant per subject, null subject included.
 *   - `createdByUserId`: who set it (`SET NULL` with the account; the
 *     setting stays).
 * - `bot_permission_rule`: a plain-language rule, `allow` (run a matching
 *   call without a card) or `ask` (a matching call asks even where it would
 *   not). A reviewer on the bot's own model reads them all before an asking
 *   call; `ask` wins when both match. Bounded per bot by the application.
 * - `bot_approval` gains what the card shows and how it was decided:
 *   - `subjectKind` / `subjectKey` / `subjectLabel`: the thing the call acts
 *     on, when the tool names one; offered as "Always allow for …".
 *   - `sharesOutside`: the call sends data out of Oppenheimer (a comment on
 *     GitHub), and the card says so.
 *   - `perCallOnly`: the tool is decided call by call (merging), so the card
 *     offers this call only.
 *   - `reviewNote`: why a rule paused it, when one did.
 *   - `reach`: how far the yes went (`once`, `tool`, `subject`); null while
 *     undecided and on a no.
 *
 * Every parent reference is composite on `("organizationId", "botId")`, so a
 * setting never points into another workspace, and goes with its bot.
 *
 * Access patterns and the index that serves each:
 * - a bot's settings and grants (every turn, Settings): `UQ_bot_tool_permission`
 *   leads with `"botId"`; the FK to bots, `IDX_bot_tool_permission_bot`;
 * - a bot's rules, oldest first (every asking call, Settings), and the FK:
 *   `IDX_bot_permission_rule_bot`;
 * - an account's deletion nulling `createdByUserId`: the two partial
 *   `_created_by` indexes.
 */
export class AddBotPermissions1791004700000 implements MigrationInterface {
  name = 'AddBotPermissions1791004700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE bot_tool_permission (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "botId" uuid NOT NULL,
        "tool" character varying(64) NOT NULL,
        "decision" character varying(8) NOT NULL,
        "subjectKind" character varying(32),
        "subjectKey" character varying(200),
        "subjectLabel" character varying(200),
        "createdByUserId" uuid,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_bot_tool_permission" PRIMARY KEY (id),
        CONSTRAINT "CHK_bot_tool_permission_decision" CHECK ("decision" IN ('allow', 'ask', 'off')),
        CONSTRAINT "CHK_bot_tool_permission_tool" CHECK (char_length("tool") > 0),
        CONSTRAINT "CHK_bot_tool_permission_subject" CHECK (num_nonnulls("subjectKind", "subjectKey", "subjectLabel") IN (0, 3)),
        CONSTRAINT "CHK_bot_tool_permission_grant" CHECK ("subjectKind" IS NULL OR "decision" = 'allow')
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bot_tool_permission" ON bot_tool_permission ("botId", "tool", "subjectKind", "subjectKey") NULLS NOT DISTINCT`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_tool_permission_bot" ON bot_tool_permission ("organizationId", "botId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_tool_permission_created_by" ON bot_tool_permission ("createdByUserId") WHERE ("createdByUserId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_tool_permission ADD CONSTRAINT "FK_bot_tool_permission_bot" FOREIGN KEY ("organizationId", "botId") REFERENCES bot("organizationId", id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_tool_permission ADD CONSTRAINT "FK_bot_tool_permission_created_by" FOREIGN KEY ("createdByUserId") REFERENCES "user"(id) ON DELETE SET NULL`,
    );

    await queryRunner.query(
      `CREATE TABLE bot_permission_rule (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "botId" uuid NOT NULL,
        "effect" character varying(8) NOT NULL,
        "text" character varying(280) NOT NULL,
        "createdByUserId" uuid,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_bot_permission_rule" PRIMARY KEY (id),
        CONSTRAINT "CHK_bot_permission_rule_effect" CHECK ("effect" IN ('allow', 'ask')),
        CONSTRAINT "CHK_bot_permission_rule_text" CHECK (char_length("text") > 0)
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_permission_rule_bot" ON bot_permission_rule ("organizationId", "botId", "createdAt", id)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_permission_rule_created_by" ON bot_permission_rule ("createdByUserId") WHERE ("createdByUserId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_permission_rule ADD CONSTRAINT "FK_bot_permission_rule_bot" FOREIGN KEY ("organizationId", "botId") REFERENCES bot("organizationId", id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_permission_rule ADD CONSTRAINT "FK_bot_permission_rule_created_by" FOREIGN KEY ("createdByUserId") REFERENCES "user"(id) ON DELETE SET NULL`,
    );

    await queryRunner.query(`
      ALTER TABLE bot_approval
        ADD COLUMN "subjectKind" character varying(32),
        ADD COLUMN "subjectKey" character varying(200),
        ADD COLUMN "subjectLabel" character varying(200),
        ADD COLUMN "sharesOutside" boolean DEFAULT false NOT NULL,
        ADD COLUMN "perCallOnly" boolean DEFAULT false NOT NULL,
        ADD COLUMN "reviewNote" character varying(400),
        ADD COLUMN "reach" character varying(8),
        ADD CONSTRAINT "CHK_bot_approval_subject" CHECK (num_nonnulls("subjectKind", "subjectKey", "subjectLabel") IN (0, 3)),
        ADD CONSTRAINT "CHK_bot_approval_reach" CHECK ("reach" IS NULL OR "reach" IN ('once', 'tool', 'subject'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bot_approval
        DROP CONSTRAINT "CHK_bot_approval_reach",
        DROP CONSTRAINT "CHK_bot_approval_subject",
        DROP COLUMN "reach",
        DROP COLUMN "reviewNote",
        DROP COLUMN "perCallOnly",
        DROP COLUMN "sharesOutside",
        DROP COLUMN "subjectLabel",
        DROP COLUMN "subjectKey",
        DROP COLUMN "subjectKind"
    `);
    await queryRunner.query(`DROP TABLE bot_permission_rule`);
    await queryRunner.query(`DROP TABLE bot_tool_permission`);
  }
}
