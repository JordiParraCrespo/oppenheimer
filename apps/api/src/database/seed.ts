import '@oppenheimer/env/load';
import { OutboxMessageSchema } from '@oppenheimer/backend-ddd';
import type { Role } from '@oppenheimer/shared';
import { DataSource, type EntityManager, IsNull } from 'typeorm';
import { ApiTokenOrmEntity } from '../api-tokens/database/api-token.orm-entity';
import { auth, closeAuthConnections } from '../auth/auth';
import { Account } from '../auth/entities/account.entity';
import { OAuthAccessTokenOrmEntity } from '../auth/entities/oauth-access-token.entity';
import { OAuthApplicationOrmEntity } from '../auth/entities/oauth-application.entity';
import { OAuthConsentOrmEntity } from '../auth/entities/oauth-consent.entity';
import { Session } from '../auth/entities/session.entity';
import { Verification } from '../auth/entities/verification.entity';
import { provisionPersonalWorkspace, type Queryable } from '../auth/personal-workspace';
import { AccessGrantOrmEntity } from '../authz/database/access-grant.orm-entity';
import { InvitationOrmEntity } from '../organizations/database/invitation.orm-entity';
import { MemberOrmEntity } from '../organizations/database/member.orm-entity';
import { OrganizationOrmEntity } from '../organizations/database/organization.orm-entity';
import { UserSettingsOrmEntity } from '../profile/database/user-settings.orm-entity';
import { RoleOrmEntity } from '../roles/database/role.orm-entity';
import { UserRoleOrmEntity } from '../roles/database/user-role.orm-entity';
import { UserOrmEntity } from '../users/database/user.orm-entity';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number.parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'oppenheimer',
  password: process.env.DB_PASSWORD || 'oppenheimer',
  database: process.env.DB_DATABASE || 'oppenheimer',
  entities: [
    UserOrmEntity,
    UserSettingsOrmEntity,
    Session,
    Account,
    Verification,
    ApiTokenOrmEntity,
    OAuthApplicationOrmEntity,
    OAuthAccessTokenOrmEntity,
    OAuthConsentOrmEntity,
    RoleOrmEntity,
    AccessGrantOrmEntity,
    UserRoleOrmEntity,
    OrganizationOrmEntity,
    MemberOrmEntity,
    InvitationOrmEntity,
    OutboxMessageSchema,
  ],
});

interface SeedUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
}

/**
 * Seed passwords are development conveniences. They can be overridden per role
 * from the environment so a non-throwaway database is never seeded with the
 * published defaults; production seeding is refused outright (see `seed()`).
 */
const seedPassword = (envVar: string, fallback: string): string =>
  process.env[envVar]?.trim() || fallback;

const seedUsers: SeedUser[] = [
  {
    email: 'superadmin@oppenheimer.dev',
    password: seedPassword('SEED_SUPERADMIN_PASSWORD', 'superadmin123456'),
    firstName: 'Super',
    lastName: 'Admin',
    role: 'superadmin',
  },
  {
    email: 'admin@oppenheimer.dev',
    password: seedPassword('SEED_ADMIN_PASSWORD', 'admin123456'),
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
  },
  {
    email: 'user@oppenheimer.dev',
    password: seedPassword('SEED_USER_PASSWORD', 'user123456'),
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
  },
];

// The published defaults. In production they are treated as "no password set".
const DEFAULT_SEED_PASSWORDS = new Set(['superadmin123456', 'admin123456', 'user123456']);
const MIN_PRODUCTION_SEED_PASSWORD_LENGTH = 12;

async function seed() {
  // Never seed a production database with these well-known accounts. The
  // published default passwords would be an instant account-takeover; a
  // deliberate override (ALLOW_PRODUCTION_SEED=true, with strong SEED_*
  // passwords set) is required to proceed.
  if (process.env.NODE_ENV === 'production') {
    if (process.env.ALLOW_PRODUCTION_SEED !== 'true') {
      throw new Error(
        'Refusing to seed with NODE_ENV=production. This seed creates well-known ' +
          'admin accounts and is intended for development only. If you really mean ' +
          'to, set strong SEED_SUPERADMIN_PASSWORD / SEED_ADMIN_PASSWORD / ' +
          'SEED_USER_PASSWORD and ALLOW_PRODUCTION_SEED=true.',
      );
    }
    // The override does not bypass the point of the refusal: every account must
    // carry a real, non-default password, or a known-password superadmin lands
    // in production exactly as if the guard were off.
    for (const seedUser of seedUsers) {
      if (
        DEFAULT_SEED_PASSWORDS.has(seedUser.password) ||
        seedUser.password.length < MIN_PRODUCTION_SEED_PASSWORD_LENGTH
      ) {
        throw new Error(
          `Refusing to seed ${seedUser.email} in production with a missing, default, or weak ` +
            `password. Set a strong SEED_${seedUser.role.toUpperCase()}_PASSWORD ` +
            `(at least ${MIN_PRODUCTION_SEED_PASSWORD_LENGTH} characters) before enabling ` +
            'ALLOW_PRODUCTION_SEED.',
        );
      }
    }
  }

  await dataSource.initialize();
  const userRepo = dataSource.getRepository(UserOrmEntity);
  const roleRepo = dataSource.getRepository(RoleOrmEntity);
  const userRoleRepo = dataSource.getRepository(UserRoleOrmEntity);

  for (const seedUser of seedUsers) {
    const existing = await userRepo.findOneBy({ email: seedUser.email });
    if (existing) continue;

    // Create the user (and its credential account) through Better Auth so the
    // password is hashed with the same algorithm used at login.
    await auth.api.signUpEmail({
      body: {
        email: seedUser.email,
        password: seedUser.password,
        name: `${seedUser.firstName} ${seedUser.lastName}`,
        firstName: seedUser.firstName,
        lastName: seedUser.lastName,
      },
    });

    // Elevate the role and mark the email verified (not settable on sign-up).
    await userRepo.update({ email: seedUser.email }, { role: seedUser.role, emailVerified: true });

    // Assign the matching role through the RBAC join (roles are seeded by the
    // migration). If the role table isn't migrated yet, the AbilityFactory's
    // legacy fallback still grants the right permissions.
    const user = await userRepo.findOneBy({ email: seedUser.email });
    const role = await roleRepo.findOneBy({ name: seedUser.role });
    if (user && role) {
      // Not `upsert`: the join's uniqueness is enforced by two *partial*
      // indexes (global assignments where `organizationId IS NULL`, scoped ones
      // where it is not), and Postgres cannot infer a partial index from a bare
      // `ON CONFLICT (userId, roleId)`. The seed only ever writes the global
      // assignment, so check for it and insert.
      const assigned = await userRoleRepo.findOneBy({
        userId: user.id,
        roleId: role.id,
        organizationId: IsNull(),
      });
      if (!assigned) {
        await userRoleRepo.insert({ userId: user.id, roleId: role.id });
      }
    }

    console.log(`Created ${seedUser.role} user: ${seedUser.email}`);
  }

  // Every account gets the personal workspace sign-up would have given it:
  // one organization, one owner member, no team. Sign-up already did this
  // for the users created above; the call is what makes the invariant
  // explicit, and what repairs a database seeded before it existed.
  for (const seedUser of seedUsers) {
    const user = await userRepo.findOneBy({ email: seedUser.email });
    if (!user) continue;
    const created = await dataSource.transaction((manager) =>
      provisionPersonalWorkspace(queryable(manager), user),
    );
    if (created) console.log(`Created personal workspace for ${seedUser.email}`);
  }

  console.log('Seeding complete.');
  await dataSource.destroy();
  // Close what importing `auth` opened, or this script hangs here with its work
  // already done.
  await closeAuthConnections();
}

/** TypeORM's `query` returns bare rows; the provisioning wants pg's shape. */
function queryable(manager: EntityManager): Queryable {
  return {
    async query<T>(sql: string, params?: unknown[]) {
      return { rows: (await manager.query(sql, params)) as T[] };
    },
  };
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
