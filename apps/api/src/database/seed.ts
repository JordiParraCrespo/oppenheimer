import '@oppenheimer/env/load';
import { OutboxMessageSchema, OutboxService } from '@oppenheimer/backend-ddd';
import type { Role } from '@oppenheimer/shared';
import { DataSource, IsNull } from 'typeorm';
import { ApiTokenOrmEntity } from '../api-tokens/database/api-token.orm-entity';
import { auth, closeAuthConnections } from '../auth/auth';
import { registerAuthCommandDispatch } from '../auth/auth-command-bus';
import { Account } from '../auth/entities/account.entity';
import { OAuthAccessTokenOrmEntity } from '../auth/entities/oauth-access-token.entity';
import { OAuthApplicationOrmEntity } from '../auth/entities/oauth-application.entity';
import { OAuthConsentOrmEntity } from '../auth/entities/oauth-consent.entity';
import { Session } from '../auth/entities/session.entity';
import { Verification } from '../auth/entities/verification.entity';
import { AccessGrantOrmEntity } from '../authz/database/access-grant.orm-entity';
import { ProvisionPersonalWorkspaceCommand } from '../organizations/commands/provision-personal-workspace/provision-personal-workspace.command';
import { ProvisionPersonalWorkspaceService } from '../organizations/commands/provision-personal-workspace/provision-personal-workspace.service';
import { InvitationOrmEntity } from '../organizations/database/invitation.orm-entity';
import { MemberOrmEntity } from '../organizations/database/member.orm-entity';
import { OrganizationOrmEntity } from '../organizations/database/organization.orm-entity';
import { PersonalWorkspaceRepository } from '../organizations/database/personal-workspace.repository';
import { PersonalWorkspaceMapper } from '../organizations/personal-workspace.mapper';
import { UserSettingsOrmEntity } from '../profile/database/user-settings.orm-entity';
import { AssignDefaultRoleCommand } from '../roles/commands/assign-default-role/assign-default-role.command';
import { AssignDefaultRoleService } from '../roles/commands/assign-default-role/assign-default-role.service';
import { RoleOrmEntity } from '../roles/database/role.orm-entity';
import { RoleRepository } from '../roles/database/role.repository';
import { UserRoleOrmEntity } from '../roles/database/user-role.orm-entity';
import { UserRoleRepository } from '../roles/database/user-role.repository';
import { RoleMapper } from '../roles/roles.mapper';
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

  // The use cases sign-up owes a new account, hand-wired.
  //
  // The seed runs as a standalone script with its own DataSource rather than
  // inside the injector, and booting the whole application to seed three rows
  // would drag in Redis, the queues and the outbox relay. The handlers and
  // their adapters are plain classes, so constructing them here costs one
  // expression each and keeps there being exactly one implementation of "the
  // default role" and "a personal workspace".
  const roleRepository = new RoleRepository(
    roleRepo,
    dataSource,
    new RoleMapper(),
    new OutboxService(dataSource),
  );
  const assignDefaultRole = new AssignDefaultRoleService(
    roleRepository,
    new UserRoleRepository(userRoleRepo, roleRepo, new RoleMapper()),
  );
  const provisionPersonalWorkspace = new ProvisionPersonalWorkspaceService(
    new PersonalWorkspaceRepository(
      dataSource.getRepository(MemberOrmEntity),
      new PersonalWorkspaceMapper(),
      new OutboxService(dataSource),
    ),
    roleRepository,
  );

  // Seeding creates its accounts through `auth.api.signUpEmail`, which fires
  // the same sign-up hook a real registration does — and that hook dispatches
  // through `auth-command-bus.ts`, which only the running API fills in. Point
  // it at the handlers above so a seeded account is provisioned exactly as a
  // registered one is, instead of the hook logging that nothing is listening.
  registerAuthCommandDispatch(async (command) => {
    if (command instanceof AssignDefaultRoleCommand) {
      return (await assignDefaultRole.execute(command)) as never;
    }
    if (command instanceof ProvisionPersonalWorkspaceCommand) {
      return (await provisionPersonalWorkspace.execute(command)) as never;
    }
    throw new Error(`The seed has no handler for ${command.constructor.name}`);
  });

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

  // Every account gets the personal workspace sign-up would have given it: one
  // organization, one owner member, no team. The hook above already did this
  // for the accounts just created; running it again is what makes the
  // invariant explicit, and what repairs a database seeded before it existed.
  // The handler is idempotent, so an account that has one is left alone.
  for (const seedUser of seedUsers) {
    const user = await userRepo.findOneBy({ email: seedUser.email });
    if (!user) continue;
    const created = await provisionPersonalWorkspace.execute(
      new ProvisionPersonalWorkspaceCommand({
        userId: user.id,
        email: user.email,
        name: user.name,
      }),
    );
    if (created) console.log(`Created personal workspace for ${seedUser.email}`);
  }

  console.log('Seeding complete.');
  await dataSource.destroy();
  // Close what importing `auth` opened, or this script hangs here with its work
  // already done.
  await closeAuthConnections();
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
