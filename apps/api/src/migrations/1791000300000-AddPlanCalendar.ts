import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plan's calendar (`product/versions/mvp/20-plan-calendar.md`): `calendar_event`,
 * the workspace's own events, and `calendar_connection`, a person's read-only
 * Google Calendar grant.
 *
 * No Google event is stored. The Google layer is read for the month on screen and
 * cached in the console, so the only Google row is the grant: the refresh token,
 * sealed with AES-256-GCM under `CALENDAR_TOKEN_KEY` (`bytea`), the account it
 * belongs to and the scopes Google granted.
 *
 * Events are wall-clock, like a task's due date (`date` plus `HH:MM` times), and
 * the `CHECK` holds their shape: all day with no times, or a start and a later end.
 * Both tables hang off the workspace with `ON DELETE CASCADE`; a connection also
 * goes with the person it belongs to. The month view reads events by
 * `("organizationId", "date")`; a connection is read by its unique key.
 */
export class AddPlanCalendar1791000300000 implements MigrationInterface {
  name = 'AddPlanCalendar1791000300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE calendar_event (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        title character varying(500) NOT NULL,
        notes text DEFAULT ''::text NOT NULL,
        date date NOT NULL,
        "allDay" boolean DEFAULT false NOT NULL,
        "startTime" character varying(5),
        "endTime" character varying(5),
        busy boolean DEFAULT true NOT NULL,
        "createdByUserId" uuid,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_calendar_event" PRIMARY KEY (id),
        CONSTRAINT "CHK_calendar_event_time_format" CHECK (
          ("startTime" IS NULL OR "startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') AND
          ("endTime" IS NULL OR "endTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
        ),
        CONSTRAINT "CHK_calendar_event_times" CHECK (
          ("allDay" AND "startTime" IS NULL AND "endTime" IS NULL) OR
          (NOT "allDay" AND "startTime" IS NOT NULL AND "endTime" IS NOT NULL AND "endTime" > "startTime")
        )
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_calendar_event_date" ON calendar_event USING btree ("organizationId", date)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_calendar_event_created_by" ON calendar_event USING btree ("createdByUserId") WHERE ("createdByUserId" IS NOT NULL)`,
    );

    await queryRunner.query(
      `CREATE TABLE calendar_connection (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        provider character varying(16) NOT NULL,
        "accountEmail" character varying(320) NOT NULL,
        "refreshTokenSealed" bytea NOT NULL,
        scopes text[] DEFAULT '{}'::text[] NOT NULL,
        status character varying(16) DEFAULT 'active'::character varying NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_calendar_connection" PRIMARY KEY (id),
        CONSTRAINT "UQ_calendar_connection_user" UNIQUE ("organizationId", "userId", provider),
        CONSTRAINT "CHK_calendar_connection_provider" CHECK (provider IN ('google')),
        CONSTRAINT "CHK_calendar_connection_status" CHECK (status IN ('active', 'revoked'))
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_calendar_connection_user" ON calendar_connection USING btree ("userId")`,
    );

    for (const statement of FOREIGN_KEYS) await queryRunner.query(statement);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE calendar_connection');
    await queryRunner.query('DROP TABLE calendar_event');
  }
}

const FOREIGN_KEYS = [
  `ALTER TABLE calendar_event ADD CONSTRAINT "FK_calendar_event_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
  `ALTER TABLE calendar_event ADD CONSTRAINT "FK_calendar_event_created_by" FOREIGN KEY ("createdByUserId") REFERENCES "user"(id) ON DELETE SET NULL`,
  `ALTER TABLE calendar_connection ADD CONSTRAINT "FK_calendar_connection_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
  `ALTER TABLE calendar_connection ADD CONSTRAINT "FK_calendar_connection_user" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE`,
];
