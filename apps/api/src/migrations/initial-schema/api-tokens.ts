import type { SchemaSlice } from './schema-slice';

/** `api_token`. See each table's ORM entity under `src/api-tokens/` for why it is shaped this way. */
export const apiTokens: SchemaSlice = {
  tables: {
    api_token: [
      `CREATE TABLE api_token (
        id uuid NOT NULL,
        "userId" uuid NOT NULL,
        name character varying(80) NOT NULL,
        prefix character varying(32) NOT NULL,
        "tokenHash" character varying(64) NOT NULL,
        scopes jsonb DEFAULT '[]'::jsonb NOT NULL,
        "organizationIds" jsonb,
        "ipAllowlist" jsonb,
        "expiresAt" timestamp with time zone,
        "lastUsedAt" timestamp with time zone,
        "revokedAt" timestamp with time zone,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
      )`,
      `ALTER TABLE api_token ADD CONSTRAINT "PK_api_token_id" PRIMARY KEY (id)`,
      `CREATE UNIQUE INDEX "IDX_api_token_tokenHash" ON api_token USING btree ("tokenHash")`,
      `CREATE INDEX "IDX_api_token_userId" ON api_token USING btree ("userId")`,
    ],
  },
  foreignKeys: [
    `ALTER TABLE api_token ADD CONSTRAINT "FK_api_token_user" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE`,
  ],
};
