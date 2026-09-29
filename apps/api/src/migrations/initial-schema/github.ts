import type { SchemaSlice } from './schema-slice';

/** `github_installation`. See each table's ORM entity under `src/github/` for why it is shaped this way. */
export const github: SchemaSlice = {
  tables: {
    github_installation: [
      `CREATE TABLE github_installation (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "githubInstallationId" bigint NOT NULL,
        "accountLogin" character varying NOT NULL,
        "accountType" character varying NOT NULL,
        "repositorySelection" character varying NOT NULL,
        "installedByUserId" uuid NOT NULL,
        "suspendedAt" timestamp with time zone,
        "deletedAt" timestamp with time zone,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        "statusChangedAt" timestamp with time zone,
        CONSTRAINT "CHK_github_installation_account_type" CHECK ("accountType" IN ('User', 'Organization')),
        CONSTRAINT "CHK_github_installation_repository_selection" CHECK ("repositorySelection" IN ('all', 'selected'))
      )`,
      `ALTER TABLE github_installation ADD CONSTRAINT "PK_github_installation" PRIMARY KEY (id)`,
      `ALTER TABLE github_installation ADD CONSTRAINT "UQ_github_installation_organization_id" UNIQUE ("organizationId", id)`,
      `CREATE INDEX "IDX_github_installation_installed_by" ON github_installation USING btree ("installedByUserId")`,
      `CREATE INDEX "IDX_github_installation_organization" ON github_installation USING btree ("organizationId")`,
      `CREATE UNIQUE INDEX "UQ_github_installation_live_github_id" ON github_installation USING btree ("githubInstallationId") WHERE ("deletedAt" IS NULL)`,
    ],
  },
  foreignKeys: [
    `ALTER TABLE github_installation ADD CONSTRAINT "FK_github_installation_installed_by" FOREIGN KEY ("installedByUserId") REFERENCES "user"(id) ON DELETE RESTRICT`,
    `ALTER TABLE github_installation ADD CONSTRAINT "FK_github_installation_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
  ],
};
