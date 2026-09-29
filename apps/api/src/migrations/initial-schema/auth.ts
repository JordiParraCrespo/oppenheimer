import type { SchemaSlice } from './schema-slice';

/** `account`, `oauthAccessToken`, `oauthApplication`, `oauthConsent`, `rateLimit`, `session`, `verification`. See each table's ORM entity under `src/auth/` for why it is shaped this way. */
export const auth: SchemaSlice = {
  tables: {
    account: [
      `CREATE TABLE account (
        id uuid NOT NULL,
        "userId" uuid NOT NULL,
        "accountId" character varying NOT NULL,
        "providerId" character varying NOT NULL,
        "accessToken" character varying,
        "refreshToken" character varying,
        "idToken" character varying,
        "accessTokenExpiresAt" timestamp with time zone,
        "refreshTokenExpiresAt" timestamp with time zone,
        scope character varying,
        password character varying,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
      )`,
      `ALTER TABLE account ADD CONSTRAINT "PK_account" PRIMARY KEY (id)`,
      `ALTER TABLE account ADD CONSTRAINT "UQ_account_providerId_accountId" UNIQUE ("providerId", "accountId")`,
      `CREATE INDEX "IDX_account_userId" ON account USING btree ("userId")`,
    ],
    oauthAccessToken: [
      `CREATE TABLE "oauthAccessToken" (
        id uuid NOT NULL,
        "accessToken" character varying,
        "refreshToken" character varying,
        "accessTokenExpiresAt" timestamp with time zone,
        "refreshTokenExpiresAt" timestamp with time zone,
        "clientId" character varying NOT NULL,
        "userId" uuid,
        scopes text NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
      )`,
      `ALTER TABLE "oauthAccessToken" ADD CONSTRAINT "PK_oauthAccessToken_id" PRIMARY KEY (id)`,
      `CREATE INDEX "IDX_oauthAccessToken_accessToken" ON "oauthAccessToken" USING btree ("accessToken")`,
      `CREATE INDEX "IDX_oauthAccessToken_clientId" ON "oauthAccessToken" USING btree ("clientId")`,
      `CREATE INDEX "IDX_oauthAccessToken_userId" ON "oauthAccessToken" USING btree ("userId")`,
    ],
    oauthApplication: [
      `CREATE TABLE "oauthApplication" (
        id uuid NOT NULL,
        name character varying,
        icon text,
        metadata text,
        "clientId" character varying NOT NULL,
        "clientSecret" character varying,
        "redirectURLs" text NOT NULL,
        type character varying NOT NULL,
        disabled boolean DEFAULT false NOT NULL,
        "userId" character varying,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
      )`,
      `ALTER TABLE "oauthApplication" ADD CONSTRAINT "PK_oauthApplication_id" PRIMARY KEY (id)`,
      `ALTER TABLE "oauthApplication" ADD CONSTRAINT "UQ_oauthApplication_clientId" UNIQUE ("clientId")`,
    ],
    oauthConsent: [
      `CREATE TABLE "oauthConsent" (
        id uuid NOT NULL,
        "clientId" character varying NOT NULL,
        "userId" uuid NOT NULL,
        scopes text NOT NULL,
        "consentGiven" boolean DEFAULT false NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
      )`,
      `ALTER TABLE "oauthConsent" ADD CONSTRAINT "PK_oauthConsent_id" PRIMARY KEY (id)`,
      `CREATE INDEX "IDX_oauthConsent_clientId" ON "oauthConsent" USING btree ("clientId")`,
      `CREATE INDEX "IDX_oauthConsent_userId" ON "oauthConsent" USING btree ("userId")`,
    ],
    rateLimit: [
      `CREATE TABLE "rateLimit" (
        id uuid NOT NULL,
        key character varying,
        count integer,
        "lastRequest" bigint
      )`,
      `ALTER TABLE "rateLimit" ADD CONSTRAINT "PK_rateLimit_id" PRIMARY KEY (id)`,
      `CREATE INDEX "IDX_rateLimit_key" ON "rateLimit" USING btree (key)`,
    ],
    session: [
      `CREATE TABLE session (
        id uuid NOT NULL,
        "userId" uuid NOT NULL,
        token character varying NOT NULL,
        "expiresAt" timestamp with time zone NOT NULL,
        "ipAddress" character varying,
        "userAgent" character varying,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        "impersonatedBy" uuid,
        "activeOrganizationId" uuid,
        "activeTeamId" uuid,
        delegated boolean DEFAULT false NOT NULL,
        "delegatedCredentialId" character varying
      )`,
      `ALTER TABLE session ADD CONSTRAINT "PK_session" PRIMARY KEY (id)`,
      `ALTER TABLE session ADD CONSTRAINT "UQ_session_token" UNIQUE (token)`,
      `CREATE INDEX "IDX_session_activeOrganizationId" ON session USING btree ("activeOrganizationId") WHERE ("activeOrganizationId" IS NOT NULL)`,
      `CREATE INDEX "IDX_session_activeTeamId" ON session USING btree ("activeTeamId") WHERE ("activeTeamId" IS NOT NULL)`,
      `CREATE INDEX "IDX_session_impersonatedBy" ON session USING btree ("impersonatedBy") WHERE ("impersonatedBy" IS NOT NULL)`,
      `CREATE INDEX "IDX_session_userId" ON session USING btree ("userId")`,
    ],
    verification: [
      `CREATE TABLE verification (
        id uuid NOT NULL,
        identifier character varying NOT NULL,
        value character varying NOT NULL,
        "expiresAt" timestamp with time zone NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
      )`,
      `ALTER TABLE verification ADD CONSTRAINT "PK_verification" PRIMARY KEY (id)`,
      `CREATE INDEX "IDX_verification_expiresAt" ON verification USING btree ("expiresAt")`,
      `CREATE INDEX "IDX_verification_identifier_createdAt" ON verification USING btree (identifier, "createdAt")`,
    ],
  },
  foreignKeys: [
    `ALTER TABLE account ADD CONSTRAINT "FK_account_user" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE`,
    `ALTER TABLE "oauthAccessToken" ADD CONSTRAINT "FK_oauthAccessToken_user" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE`,
    `ALTER TABLE "oauthConsent" ADD CONSTRAINT "FK_oauthConsent_user" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE`,
    `ALTER TABLE session ADD CONSTRAINT "FK_session_activeOrganization" FOREIGN KEY ("activeOrganizationId") REFERENCES organization(id) ON DELETE SET NULL`,
    `ALTER TABLE session ADD CONSTRAINT "FK_session_activeTeam" FOREIGN KEY ("activeTeamId") REFERENCES team(id) ON DELETE SET NULL`,
    `ALTER TABLE session ADD CONSTRAINT "FK_session_impersonatedBy" FOREIGN KEY ("impersonatedBy") REFERENCES "user"(id) ON DELETE CASCADE`,
    `ALTER TABLE session ADD CONSTRAINT "FK_session_user" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE`,
  ],
};
