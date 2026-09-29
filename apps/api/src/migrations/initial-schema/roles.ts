import type { SchemaSlice } from './schema-slice';

/** `role`, `role_catalog_version`, `user_role`, `user_role_version`. See each table's ORM entity under `src/roles/` for why it is shaped this way. */
export const roles: SchemaSlice = {
  tables: {
    role: [
      `CREATE TABLE role (
        id uuid NOT NULL,
        name character varying NOT NULL,
        description character varying,
        "isSystem" boolean DEFAULT false NOT NULL,
        permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        "organizationId" uuid
      )`,
      `ALTER TABLE role ADD CONSTRAINT "PK_role_id" PRIMARY KEY (id)`,
      `CREATE UNIQUE INDEX "UQ_role_global_name" ON role USING btree (name) WHERE ("organizationId" IS NULL)`,
      `CREATE UNIQUE INDEX "UQ_role_org_name" ON role USING btree ("organizationId", name) WHERE ("organizationId" IS NOT NULL)`,
    ],
    role_catalog_version: [
      `CREATE TABLE role_catalog_version (
        id smallint DEFAULT 1 NOT NULL,
        version bigint DEFAULT 1 NOT NULL,
        CONSTRAINT "CHK_role_catalog_version_singleton" CHECK ((id = 1))
      )`,
      `ALTER TABLE role_catalog_version ADD CONSTRAINT "PK_role_catalog_version" PRIMARY KEY (id)`,
    ],
    user_role: [
      `CREATE TABLE user_role (
        "userId" uuid NOT NULL,
        "roleId" uuid NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "organizationId" uuid,
        id uuid DEFAULT gen_random_uuid() NOT NULL
      )`,
      `ALTER TABLE user_role ADD CONSTRAINT "PK_user_role" PRIMARY KEY (id)`,
      `CREATE INDEX "IDX_user_role_organization" ON user_role USING btree ("organizationId") WHERE ("organizationId" IS NOT NULL)`,
      `CREATE INDEX "IDX_user_role_role" ON user_role USING btree ("roleId")`,
      `CREATE INDEX "IDX_user_role_userId" ON user_role USING btree ("userId")`,
      `CREATE INDEX "IDX_user_role_user_org" ON user_role USING btree ("userId", "organizationId")`,
      `CREATE UNIQUE INDEX "UQ_user_role_global" ON user_role USING btree ("userId", "roleId") WHERE ("organizationId" IS NULL)`,
      `CREATE UNIQUE INDEX "UQ_user_role_scoped" ON user_role USING btree ("userId", "roleId", "organizationId") WHERE ("organizationId" IS NOT NULL)`,
    ],
    user_role_version: [
      `CREATE TABLE user_role_version (
        "userId" uuid NOT NULL,
        version bigint DEFAULT 1 NOT NULL
      )`,
      `ALTER TABLE user_role_version ADD CONSTRAINT "PK_user_role_version" PRIMARY KEY ("userId")`,
    ],
  },
  foreignKeys: [
    `ALTER TABLE role ADD CONSTRAINT "FK_role_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
    `ALTER TABLE user_role ADD CONSTRAINT "FK_user_role_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
    `ALTER TABLE user_role ADD CONSTRAINT "FK_user_role_role" FOREIGN KEY ("roleId") REFERENCES role(id) ON DELETE CASCADE`,
    `ALTER TABLE user_role ADD CONSTRAINT "FK_user_role_user" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE`,
    `ALTER TABLE user_role_version ADD CONSTRAINT "FK_user_role_version_user" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE`,
  ],
};
