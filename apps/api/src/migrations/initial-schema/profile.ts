import type { SchemaSlice } from './schema-slice';

/** `user_settings`. See each table's ORM entity under `src/profile/` for why it is shaped this way. */
export const profile: SchemaSlice = {
  tables: {
    user_settings: [
      `CREATE TABLE user_settings (
        "userId" uuid NOT NULL,
        theme character varying DEFAULT 'system'::character varying NOT NULL,
        locale character varying DEFAULT 'en'::character varying NOT NULL,
        density character varying DEFAULT 'comfortable'::character varying NOT NULL,
        "weeklyDigest" boolean DEFAULT true NOT NULL,
        "productUpdates" boolean DEFAULT false NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
      )`,
      `ALTER TABLE user_settings ADD CONSTRAINT "PK_user_settings" PRIMARY KEY ("userId")`,
    ],
  },
  foreignKeys: [
    `ALTER TABLE user_settings ADD CONSTRAINT "FK_user_settings_user" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE`,
  ],
};
