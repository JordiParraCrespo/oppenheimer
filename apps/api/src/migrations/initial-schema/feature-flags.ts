import type { SchemaSlice } from './schema-slice';

/** `feature_flag`, `feature_flag_change`, `feature_flag_segment`. See each table's ORM entity under `src/feature-flags/` for why it is shaped this way. */
export const featureFlags: SchemaSlice = {
  tables: {
    feature_flag: [
      `CREATE TABLE feature_flag (
        id uuid NOT NULL,
        key character varying(64) NOT NULL,
        enabled boolean DEFAULT false NOT NULL,
        rules jsonb DEFAULT '[]'::jsonb NOT NULL,
        fallthrough jsonb NOT NULL,
        salt character varying(32) NOT NULL,
        "updatedBy" uuid,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
      )`,
      `ALTER TABLE feature_flag ADD CONSTRAINT "PK_feature_flag" PRIMARY KEY (id)`,
      `ALTER TABLE feature_flag ADD CONSTRAINT "UQ_feature_flag_key" UNIQUE (key)`,
    ],
    feature_flag_change: [
      `CREATE TABLE feature_flag_change (
        id uuid NOT NULL,
        "subjectType" character varying(16) NOT NULL,
        "subjectKey" character varying(64) NOT NULL,
        action character varying(32) NOT NULL,
        "actorId" uuid,
        comment character varying(500),
        before jsonb,
        after jsonb,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "CHK_feature_flag_change_action" CHECK (action IN ('targeting_updated', 'toggled', 'segment_created', 'segment_updated', 'segment_deleted')),
        CONSTRAINT "CHK_feature_flag_change_subject_type" CHECK ("subjectType" IN ('flag', 'segment'))
      )`,
      `ALTER TABLE feature_flag_change ADD CONSTRAINT "PK_feature_flag_change" PRIMARY KEY (id)`,
      `CREATE INDEX "IDX_feature_flag_change_created" ON feature_flag_change USING btree ("createdAt")`,
      `CREATE INDEX "IDX_feature_flag_change_subject" ON feature_flag_change USING btree ("subjectType", "subjectKey", "createdAt")`,
    ],
    feature_flag_segment: [
      `CREATE TABLE feature_flag_segment (
        id uuid NOT NULL,
        key character varying(64) NOT NULL,
        name character varying(100) NOT NULL,
        description character varying(255),
        conditions jsonb DEFAULT '[]'::jsonb NOT NULL,
        "updatedBy" uuid,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
      )`,
      `ALTER TABLE feature_flag_segment ADD CONSTRAINT "PK_feature_flag_segment" PRIMARY KEY (id)`,
      `ALTER TABLE feature_flag_segment ADD CONSTRAINT "UQ_feature_flag_segment_key" UNIQUE (key)`,
    ],
  },
  foreignKeys: [],
};
