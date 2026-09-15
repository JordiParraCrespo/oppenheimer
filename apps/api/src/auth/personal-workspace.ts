import { randomUUID } from 'node:crypto';

/**
 * The one SQL surface both callers share: Better Auth's `pg` client inside
 * the sign-up hook, and the seed's TypeORM transaction. Each adapts its own
 * driver to this shape rather than the provisioning knowing either.
 */
export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface PersonalWorkspaceUser {
  id: string;
  email: string;
  name?: string | null;
}

/**
 * Creates the personal workspace a new account lives in.
 *
 * The product model is one user per workspace for now
 * (`product/versions/mvp/00-scope.md`): the workspace is a row in
 * `organization` with the account as its single `owner` member, plus the
 * org-scoped `owner` application role that lets the account open it. No
 * team, no roster, no invitation — those come with the teams slice on the
 * same tables.
 *
 * Idempotent: an account that already belongs to an organization gets
 * nothing. That is what makes the seed and the sign-up hook safe to run on
 * the same user, and what keeps an invited account (once invitations exist)
 * from collecting a second workspace it never asked for.
 *
 * Throws when the `owner` system role is missing: an organization nobody can
 * open is worse than no organization, which is exactly the state the
 * onboarding screen exists to recover from.
 */
export async function provisionPersonalWorkspace(
  db: Queryable,
  user: PersonalWorkspaceUser,
): Promise<{ organizationId: string } | null> {
  const { rows: memberships } = await db.query<{ organizationId: string }>(
    `SELECT "organizationId" FROM "member" WHERE "userId" = $1 LIMIT 1`,
    [user.id],
  );
  if (memberships.length > 0) return null;

  const { rows: roles } = await db.query<{ id: string }>(
    `SELECT "id" FROM "role" WHERE "name" = 'owner' AND "organizationId" IS NULL LIMIT 1`,
  );
  const ownerRole = roles[0];
  if (!ownerRole) {
    throw new Error('Required system role "owner" is missing; run the migrations first');
  }

  const displayName = user.name?.trim() || user.email.split('@')[0];
  const organizationId = randomUUID();
  await db.query(
    `INSERT INTO "organization" ("id", "name", "slug", "createdAt") VALUES ($1, $2, $3, now())`,
    [organizationId, displayName, personalWorkspaceSlug(displayName)],
  );
  await db.query(
    `INSERT INTO "member" ("id", "organizationId", "userId", "role", "createdAt")
       VALUES ($1, $2, $3, 'owner', now())`,
    [randomUUID(), organizationId, user.id],
  );
  await db.query(
    `INSERT INTO "user_role" ("userId", "roleId", "organizationId") VALUES ($1, $2, $3)`,
    [user.id, ownerRole.id, organizationId],
  );
  return { organizationId };
}

/**
 * Same shape as `OrganizationsService.slugify`: the display name reduced to
 * URL characters, then a random suffix so two people called the same thing
 * never collide on the unique `slug` column.
 */
function personalWorkspaceSlug(displayName: string): string {
  const cleaned = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return `${cleaned || 'workspace'}-${randomUUID().slice(0, 8)}`;
}
