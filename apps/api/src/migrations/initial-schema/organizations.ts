import type { SchemaSlice } from './schema-slice';

/** `invitation`, `member`, `organization`, `team`, `teamMember`. See each table's ORM entity under `src/organizations/` for why it is shaped this way. */
export const organizations: SchemaSlice = {
  tables: {
    invitation: [
      `CREATE TABLE invitation (
        id uuid NOT NULL,
        "organizationId" uuid NOT NULL,
        email character varying NOT NULL,
        role character varying,
        status character varying DEFAULT 'pending'::character varying NOT NULL,
        "teamId" uuid,
        "inviterId" uuid NOT NULL,
        "expiresAt" timestamp with time zone NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL
      )`,
      `ALTER TABLE invitation ADD CONSTRAINT "PK_invitation_id" PRIMARY KEY (id)`,
      `CREATE INDEX "IDX_invitation_email" ON invitation USING btree (email)`,
      `CREATE INDEX "IDX_invitation_inviterId" ON invitation USING btree ("inviterId")`,
      `CREATE INDEX "IDX_invitation_organizationId" ON invitation USING btree ("organizationId")`,
      `CREATE INDEX "IDX_invitation_teamId" ON invitation USING btree ("teamId") WHERE ("teamId" IS NOT NULL)`,
    ],
    member: [
      `CREATE TABLE member (
        id uuid NOT NULL,
        "organizationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        role character varying DEFAULT 'member'::character varying NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL
      )`,
      `ALTER TABLE member ADD CONSTRAINT "PK_member_id" PRIMARY KEY (id)`,
      `CREATE INDEX "IDX_member_organizationId" ON member USING btree ("organizationId")`,
      `CREATE INDEX "IDX_member_userId" ON member USING btree ("userId")`,
    ],
    organization: [
      `CREATE TABLE organization (
        id uuid NOT NULL,
        name character varying NOT NULL,
        slug character varying NOT NULL,
        logo character varying,
        metadata text,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "roleVersion" integer DEFAULT 1 NOT NULL
      )`,
      `ALTER TABLE organization ADD CONSTRAINT "PK_organization_id" PRIMARY KEY (id)`,
      `ALTER TABLE organization ADD CONSTRAINT "UQ_organization_slug" UNIQUE (slug)`,
    ],
    team: [
      `CREATE TABLE team (
        id uuid NOT NULL,
        name character varying NOT NULL,
        "organizationId" uuid NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone
      )`,
      `ALTER TABLE team ADD CONSTRAINT "PK_team_id" PRIMARY KEY (id)`,
      `CREATE INDEX "IDX_team_organizationId" ON team USING btree ("organizationId")`,
    ],
    teamMember: [
      `CREATE TABLE "teamMember" (
        id uuid NOT NULL,
        "teamId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL
      )`,
      `ALTER TABLE "teamMember" ADD CONSTRAINT "PK_teamMember_id" PRIMARY KEY (id)`,
      `CREATE INDEX "IDX_teamMember_teamId" ON "teamMember" USING btree ("teamId")`,
      `CREATE INDEX "IDX_teamMember_userId" ON "teamMember" USING btree ("userId")`,
    ],
  },
  foreignKeys: [
    `ALTER TABLE invitation ADD CONSTRAINT "FK_invitation_inviter" FOREIGN KEY ("inviterId") REFERENCES "user"(id) ON DELETE CASCADE`,
    `ALTER TABLE invitation ADD CONSTRAINT "FK_invitation_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
    `ALTER TABLE invitation ADD CONSTRAINT "FK_invitation_team" FOREIGN KEY ("teamId") REFERENCES team(id) ON DELETE SET NULL`,
    `ALTER TABLE member ADD CONSTRAINT "FK_member_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
    `ALTER TABLE member ADD CONSTRAINT "FK_member_user" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE`,
    `ALTER TABLE "teamMember" ADD CONSTRAINT "FK_teamMember_team" FOREIGN KEY ("teamId") REFERENCES team(id) ON DELETE CASCADE`,
    `ALTER TABLE "teamMember" ADD CONSTRAINT "FK_teamMember_user" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE`,
    `ALTER TABLE team ADD CONSTRAINT "FK_team_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
  ],
};
