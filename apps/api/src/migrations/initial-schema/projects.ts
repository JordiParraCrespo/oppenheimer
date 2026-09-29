import type { SchemaSlice } from './schema-slice';

/** `project`, `project_repository`. See each table's ORM entity under `src/projects/` for why it is shaped this way. */
export const projects: SchemaSlice = {
  tables: {
    project: [
      `CREATE TABLE project (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        name character varying NOT NULL,
        slug character varying NOT NULL,
        "archivedAt" timestamp with time zone,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        "defaultHostId" uuid,
        "defaultAgent" character varying,
        "createdByUserId" uuid,
        "isUnassigned" boolean DEFAULT false NOT NULL
      )`,
      `ALTER TABLE project ADD CONSTRAINT "PK_project" PRIMARY KEY (id)`,
      `ALTER TABLE project ADD CONSTRAINT "UQ_project_organization_id" UNIQUE ("organizationId", id)`,
      `ALTER TABLE project ADD CONSTRAINT "UQ_project_organization_slug" UNIQUE ("organizationId", slug)`,
      `CREATE INDEX "IDX_project_created_by" ON project USING btree ("createdByUserId") WHERE ("createdByUserId" IS NOT NULL)`,
      `CREATE INDEX "IDX_project_default_host" ON project USING btree ("defaultHostId")`,
      `CREATE INDEX "IDX_project_organization" ON project USING btree ("organizationId")`,
      `CREATE UNIQUE INDEX "UQ_project_organization_unassigned" ON project USING btree ("organizationId") WHERE "isUnassigned"`,
    ],
    project_repository: [
      `CREATE TABLE project_repository (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "projectId" uuid NOT NULL,
        "installationId" uuid NOT NULL,
        "githubRepoId" bigint NOT NULL,
        "repositoryFullName" character varying NOT NULL,
        "isDefault" boolean NOT NULL,
        "baseBranch" character varying NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "organizationId" uuid NOT NULL,
        "position" smallint NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
      )`,
      `ALTER TABLE project_repository ADD CONSTRAINT "PK_project_repository" PRIMARY KEY (id)`,
      `ALTER TABLE project_repository ADD CONSTRAINT "UQ_project_repository_project_repo" UNIQUE ("projectId", "githubRepoId")`,
      `CREATE INDEX "IDX_project_repository_installation" ON project_repository USING btree ("organizationId", "installationId")`,
      `CREATE INDEX "IDX_project_repository_organization_repo" ON project_repository USING btree ("organizationId", "githubRepoId")`,
    ],
  },
  foreignKeys: [
    `ALTER TABLE project ADD CONSTRAINT "FK_project_created_by" FOREIGN KEY ("createdByUserId") REFERENCES "user"(id) ON DELETE SET NULL`,
    `ALTER TABLE project ADD CONSTRAINT "FK_project_default_host" FOREIGN KEY ("defaultHostId") REFERENCES host(id) ON DELETE SET NULL`,
    `ALTER TABLE project ADD CONSTRAINT "FK_project_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE RESTRICT`,
    `ALTER TABLE project_repository ADD CONSTRAINT "FK_project_repository_installation" FOREIGN KEY ("organizationId", "installationId") REFERENCES github_installation("organizationId", id) ON DELETE CASCADE`,
    `ALTER TABLE project_repository ADD CONSTRAINT "FK_project_repository_project" FOREIGN KEY ("organizationId", "projectId") REFERENCES project("organizationId", id) ON DELETE CASCADE`,
  ],
};
