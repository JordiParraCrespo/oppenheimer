import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bots, slice 1 (`product/versions/mvp/25-bots.md`): the bot, the sidebar
 * groups it sits in, its two documents with their history, and what it
 * remembers. No runtime yet: turns, messages, proposals and approvals are the
 * later slices' tables.
 *
 * - `bot`: who it is (name, description, avatar colour), where it sits
 *   (`groupId`, `position`), where it runs (`homeHostId`) and how it is started
 *   (`model`, `effort`, `permission`, `learnAutomatically`). Workspace-owned:
 *   it goes with its organization. `createdByUserId` and `homeHostId` only lose
 *   their link (`SET NULL`): the bot is the workspace's, and a removed host
 *   leaves a bot to be pointed at another. Names are not unique; the API numbers
 *   a new bot's name when the workspace has it ("New Bot 2").
 * - `bot_group`: a sidebar heading. Unique by name in a workspace, whatever the
 *   case (`lower(name)`). Deleting one ungroups its bots (`ON DELETE SET NULL
 *   ("groupId")`, Postgres 15+, so the workspace column stays); the API also
 *   moves them to the end of the ungrouped list in the same transaction.
 * - `bot_document`: the current `soul` and `instructions`, one row per bot and
 *   name, keyed by the pair. `revision` is the optimistic lock a save is
 *   conditioned on.
 * - `bot_document_revision`: every saved version, append-only (no `updatedAt`).
 *   A revert is a new row with `revertedFrom`. It grows at the pace people and
 *   the bot edit two documents and goes with the bot; no retention job.
 * - `bot_memory_fact`: one row per remembered fact, capped per bot by the API
 *   (`BOT_MEMORY_FACTS_MAX`), counted under a lock on the bot's row.
 *
 * Every child key carries the workspace and references its parent on
 * `("organizationId", …)`, so nothing can point into another tenant and the
 * children need no foreign key of their own to `organization`. `effort` has no
 * `CHECK`, as on `automation_revision`: its vocabulary is the agents catalog's,
 * which grows with the CLIs, and the API records only a level the model offers.
 *
 * Access patterns and the index that serves each:
 * - the workspace's bots (a sidebar's worth, ordered by group and position),
 *   and one group's bots in order, which a move renumbers under `FOR UPDATE`:
 *   `IDX_bot_group_position`;
 * - the workspace's groups in order: `IDX_bot_group_position_order`;
 * - a group name taken: `UQ_bot_group_name`;
 * - a bot's documents, one document: `PK_bot_document`;
 * - a document's revisions newest first, one revision: `UQ_bot_document_revision`;
 * - a bot's memory, newest first, and its count: `IDX_bot_memory_fact_bot`.
 *
 * The owner role's rule for the new `Bot` subject is appended to the global
 * system row, and the role catalog's version bumped so cached abilities are
 * rebuilt (`rbac-roles.md`).
 */
export class AddBots1791001400000 implements MigrationInterface {
  name = 'AddBots1791001400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE bot_group (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        name character varying(60) NOT NULL,
        "position" integer DEFAULT 0 NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_bot_group" PRIMARY KEY (id),
        CONSTRAINT "UQ_bot_group_organization_id" UNIQUE ("organizationId", id),
        CONSTRAINT "CHK_bot_group_name" CHECK (char_length(btrim(name)) > 0),
        CONSTRAINT "CHK_bot_group_position" CHECK ("position" >= 0)
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bot_group_name" ON bot_group USING btree ("organizationId", lower(name))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_group_position_order" ON bot_group USING btree ("organizationId", "position")`,
    );

    await queryRunner.query(
      `CREATE TABLE bot (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "createdByUserId" uuid,
        name character varying(80) NOT NULL,
        description character varying(280) DEFAULT '' NOT NULL,
        "avatarColor" character varying(16) DEFAULT 'mint' NOT NULL,
        "groupId" uuid,
        "position" integer DEFAULT 0 NOT NULL,
        "homeHostId" uuid,
        model character varying(128),
        effort character varying(16),
        permission character varying(8) DEFAULT 'auto' NOT NULL,
        "learnAutomatically" boolean DEFAULT true NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_bot" PRIMARY KEY (id),
        CONSTRAINT "UQ_bot_organization_id" UNIQUE ("organizationId", id),
        CONSTRAINT "CHK_bot_name" CHECK (char_length(btrim(name)) > 0),
        CONSTRAINT "CHK_bot_avatar_color" CHECK ("avatarColor" IN ('mint', 'tangerine', 'snow', 'sky', 'lilac', 'lemon', 'coral', 'moss')),
        CONSTRAINT "CHK_bot_position" CHECK ("position" >= 0),
        CONSTRAINT "CHK_bot_permission" CHECK (permission IN ('auto', 'full'))
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_group_position" ON bot USING btree ("organizationId", "groupId", "position")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_created_by" ON bot USING btree ("createdByUserId") WHERE ("createdByUserId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_home_host" ON bot USING btree ("homeHostId") WHERE ("homeHostId" IS NOT NULL)`,
    );

    await queryRunner.query(
      `CREATE TABLE bot_document (
        "organizationId" uuid NOT NULL,
        "botId" uuid NOT NULL,
        name character varying(16) NOT NULL,
        content text DEFAULT ''::text NOT NULL,
        revision integer DEFAULT 1 NOT NULL,
        "updatedBy" character varying(8) DEFAULT 'user' NOT NULL,
        "updatedByUserId" uuid,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_bot_document" PRIMARY KEY ("organizationId", "botId", name),
        CONSTRAINT "CHK_bot_document_name" CHECK (name IN ('soul', 'instructions')),
        CONSTRAINT "CHK_bot_document_content" CHECK (char_length(content) <= 32768),
        CONSTRAINT "CHK_bot_document_revision" CHECK (revision >= 1),
        CONSTRAINT "CHK_bot_document_updated_by" CHECK ("updatedBy" IN ('user', 'bot')),
        CONSTRAINT "CHK_bot_document_bot_has_no_user" CHECK ("updatedBy" = 'user' OR "updatedByUserId" IS NULL)
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_document_updated_by" ON bot_document USING btree ("updatedByUserId") WHERE ("updatedByUserId" IS NOT NULL)`,
    );

    await queryRunner.query(
      `CREATE TABLE bot_document_revision (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "botId" uuid NOT NULL,
        name character varying(16) NOT NULL,
        revision integer NOT NULL,
        content text NOT NULL,
        author character varying(8) NOT NULL,
        "authorUserId" uuid,
        note character varying(200) DEFAULT '' NOT NULL,
        "revertedFrom" integer,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_bot_document_revision" PRIMARY KEY (id),
        CONSTRAINT "UQ_bot_document_revision" UNIQUE ("organizationId", "botId", name, revision),
        CONSTRAINT "CHK_bot_document_revision_content" CHECK (char_length(content) <= 32768),
        CONSTRAINT "CHK_bot_document_revision_number" CHECK (revision >= 1),
        CONSTRAINT "CHK_bot_document_revision_author" CHECK (author IN ('user', 'bot')),
        CONSTRAINT "CHK_bot_document_revision_bot_has_no_user" CHECK (author = 'user' OR "authorUserId" IS NULL),
        CONSTRAINT "CHK_bot_document_revision_reverted_from" CHECK ("revertedFrom" IS NULL OR ("revertedFrom" >= 1 AND "revertedFrom" < revision))
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_document_revision_author" ON bot_document_revision USING btree ("authorUserId") WHERE ("authorUserId" IS NOT NULL)`,
    );

    await queryRunner.query(
      `CREATE TABLE bot_memory_fact (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "botId" uuid NOT NULL,
        content character varying(500) NOT NULL,
        source character varying(8) DEFAULT 'user' NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_bot_memory_fact" PRIMARY KEY (id),
        CONSTRAINT "CHK_bot_memory_fact_content" CHECK (char_length(btrim(content)) > 0),
        CONSTRAINT "CHK_bot_memory_fact_source" CHECK (source IN ('user', 'bot'))
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_memory_fact_bot" ON bot_memory_fact USING btree ("organizationId", "botId", "createdAt", id)`,
    );

    for (const statement of FOREIGN_KEYS) await queryRunner.query(statement);

    await queryRunner.query(
      `UPDATE "role" SET permissions = permissions || $1::jsonb
        WHERE name = 'owner' AND "organizationId" IS NULL AND "isSystem"`,
      [JSON.stringify(OWNER_RULES)],
    );
    await queryRunner.query(`UPDATE "role_catalog_version" SET "version" = "version" + 1`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "role" SET permissions = (
         SELECT COALESCE(jsonb_agg(rule), '[]'::jsonb)
           FROM jsonb_array_elements(permissions) rule
          WHERE NOT (rule->>'subject' = ANY($1))
       )
       WHERE name = 'owner' AND "organizationId" IS NULL AND "isSystem"`,
      [OWNER_RULES.map((rule) => rule.subject)],
    );
    await queryRunner.query(`UPDATE "role_catalog_version" SET "version" = "version" + 1`);
    await queryRunner.query('DROP TABLE bot_memory_fact');
    await queryRunner.query('DROP TABLE bot_document_revision');
    await queryRunner.query('DROP TABLE bot_document');
    await queryRunner.query('DROP TABLE bot');
    await queryRunner.query('DROP TABLE bot_group');
  }
}

const OWNER_RULES = [
  {
    action: 'manage',
    subject: 'Bot',
    conditions: { organizationId: '${activeOrganizationId}' },
  },
];

const FOREIGN_KEYS = [
  `ALTER TABLE bot_group ADD CONSTRAINT "FK_bot_group_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
  `ALTER TABLE bot ADD CONSTRAINT "FK_bot_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
  `ALTER TABLE bot ADD CONSTRAINT "FK_bot_group" FOREIGN KEY ("organizationId", "groupId") REFERENCES bot_group("organizationId", id) ON DELETE SET NULL ("groupId")`,
  `ALTER TABLE bot ADD CONSTRAINT "FK_bot_created_by" FOREIGN KEY ("createdByUserId") REFERENCES "user"(id) ON DELETE SET NULL`,
  `ALTER TABLE bot ADD CONSTRAINT "FK_bot_home_host" FOREIGN KEY ("homeHostId") REFERENCES host(id) ON DELETE SET NULL`,
  `ALTER TABLE bot_document ADD CONSTRAINT "FK_bot_document_bot" FOREIGN KEY ("organizationId", "botId") REFERENCES bot("organizationId", id) ON DELETE CASCADE`,
  `ALTER TABLE bot_document ADD CONSTRAINT "FK_bot_document_updated_by" FOREIGN KEY ("updatedByUserId") REFERENCES "user"(id) ON DELETE SET NULL`,
  `ALTER TABLE bot_document_revision ADD CONSTRAINT "FK_bot_document_revision_document" FOREIGN KEY ("organizationId", "botId", name) REFERENCES bot_document("organizationId", "botId", name) ON DELETE CASCADE`,
  `ALTER TABLE bot_document_revision ADD CONSTRAINT "FK_bot_document_revision_author" FOREIGN KEY ("authorUserId") REFERENCES "user"(id) ON DELETE SET NULL`,
  `ALTER TABLE bot_memory_fact ADD CONSTRAINT "FK_bot_memory_fact_bot" FOREIGN KEY ("organizationId", "botId") REFERENCES bot("organizationId", id) ON DELETE CASCADE`,
];
