import { USERNAME_PATTERN } from '@oppenheimer/shared';
import type { SchemaSlice } from './schema-slice';

/** `user`. See each table's ORM entity under `src/users/` for why it is shaped this way. */
export const users: SchemaSlice = {
  tables: {
    user: [
      `CREATE TABLE "user" (
        id uuid NOT NULL,
        name character varying NOT NULL,
        email character varying NOT NULL,
        "emailVerified" boolean DEFAULT false NOT NULL,
        image character varying,
        "firstName" character varying NOT NULL,
        "lastName" character varying NOT NULL,
        role character varying DEFAULT 'user'::character varying NOT NULL,
        "isActive" boolean DEFAULT true NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        banned boolean DEFAULT false NOT NULL,
        "banReason" character varying,
        "banExpires" timestamp with time zone,
        phone character varying,
        "jobTitle" character varying,
        username character varying(39),
        CONSTRAINT "CHK_user_username" CHECK (((username IS NULL) OR ((username)::text ~ '${USERNAME_PATTERN.source}'::text)))
      )`,
      `ALTER TABLE "user" ADD CONSTRAINT "PK_user" PRIMARY KEY (id)`,
      `ALTER TABLE "user" ADD CONSTRAINT "UQ_user_email" UNIQUE (email)`,
      `ALTER TABLE "user" ADD CONSTRAINT "UQ_user_username" UNIQUE (username)`,
      `CREATE INDEX "IDX_user_search_trgm" ON "user" USING gin ("firstName" gin_trgm_ops, "lastName" gin_trgm_ops, email gin_trgm_ops)`,
    ],
  },
  foreignKeys: [],
};
