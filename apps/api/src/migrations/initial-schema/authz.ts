import type { SchemaSlice } from './schema-slice';

/** `access_grant`. See each table's ORM entity under `src/authz/` for why it is shaped this way. */
export const authz: SchemaSlice = {
  tables: {
    access_grant: [
      `CREATE TABLE access_grant (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "principalType" character varying NOT NULL,
        "principalId" uuid NOT NULL,
        "resourceType" character varying NOT NULL,
        "resourceId" uuid,
        "grantedBy" uuid NOT NULL,
        "expiresAt" timestamp with time zone,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "CHK_access_grant_principal_type" CHECK ("principalType" IN ('user', 'team', 'role'))
      )`,
      `ALTER TABLE access_grant ADD CONSTRAINT "PK_access_grant" PRIMARY KEY (id)`,
      `CREATE INDEX "IDX_access_grant_expiry" ON access_grant USING btree ("expiresAt") WHERE ("expiresAt" IS NOT NULL)`,
      `CREATE INDEX "IDX_access_grant_lookup" ON access_grant USING btree ("organizationId", "principalType", "principalId", "resourceType")`,
    ],
  },
  foreignKeys: [
    `ALTER TABLE access_grant ADD CONSTRAINT "FK_access_grant_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
  ],
};
