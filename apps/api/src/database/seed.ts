import '@oppenheimer/env/load';
import { OutboxMessageSchema, OutboxService } from '@oppenheimer/backend-ddd';
import { ROLES, type Role } from '@oppenheimer/shared';
import { DataSource } from 'typeorm';
import { ApiTokenOrmEntity } from '../api-tokens/database/api-token.orm-entity';
import { Account } from '../auth/database/account.orm-entity';
import { OAuthAccessTokenOrmEntity } from '../auth/database/oauth-access-token.orm-entity';
import { OAuthApplicationOrmEntity } from '../auth/database/oauth-application.orm-entity';
import { OAuthConsentOrmEntity } from '../auth/database/oauth-consent.orm-entity';
import { Session } from '../auth/database/session.orm-entity';
import { Verification } from '../auth/database/verification.orm-entity';
import { auth, closeAuthConnections } from '../auth/infrastructure/better-auth.config';
import { AccessGrantOrmEntity } from '../authz/database/access-grant.orm-entity';
import { GithubInstallationOrmEntity } from '../github/database/github-installation.orm-entity';
import { HostOrmEntity } from '../hosts/database/host.orm-entity';
import { HostPairingTokenOrmEntity } from '../hosts/database/host-pairing-token.orm-entity';
import { ProvisionPersonalWorkspaceCommand } from '../organizations/commands/provision-personal-workspace/provision-personal-workspace.command';
import { ProvisionPersonalWorkspaceCommandHandler } from '../organizations/commands/provision-personal-workspace/provision-personal-workspace.command-handler';
import { InvitationOrmEntity } from '../organizations/database/invitation.orm-entity';
import { MemberOrmEntity } from '../organizations/database/member.orm-entity';
import { OrganizationOrmEntity } from '../organizations/database/organization.orm-entity';
import { PersonalWorkspaceRepository } from '../organizations/database/personal-workspace.repository';
import { UserSettingsOrmEntity } from '../profile/database/user-settings.orm-entity';
import { ProjectOrmEntity } from '../projects/database/project.orm-entity';
import { AssignDefaultRoleCommand } from '../roles/commands/assign-default-role/assign-default-role.command';
import { AssignDefaultRoleCommandHandler } from '../roles/commands/assign-default-role/assign-default-role.command-handler';
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
    HostOrmEntity,
    HostPairingTokenOrmEntity,
    UserRoleOrmEntity,
    GithubInstallationOrmEntity,
    OrganizationOrmEntity,
    MemberOrmEntity,
    InvitationOrmEntity,
    ProjectOrmEntity,
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
  //
  // The sign-up hook fires while seeding too, but finds no command bus outside
  // the API and does nothing — so this script owes itself these side effects,
  // and calls the handlers directly rather than installing a second bus for
  // the hook to reach. That is also what repairs a database seeded before the
  // personal workspace existed: both handlers are idempotent.
  const roleMapper = new RoleMapper();
  const roleRepository = new RoleRepository(
    roleRepo,
    dataSource,
    roleMapper,
    new OutboxService(dataSource),
  );
  const userRoleRepository = new UserRoleRepository(userRoleRepo, roleRepo, roleMapper);
  const assignDefaultRole = new AssignDefaultRoleCommandHandler(roleRepository, userRoleRepository);
  const provisionPersonalWorkspace = new ProvisionPersonalWorkspaceCommandHandler(
    new PersonalWorkspaceRepository(dataSource, new OutboxService(dataSource), userRoleRepository),
    roleRepository,
  );

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

    // Elevate this account to its seed role. Only the elevation is written
    // here: the default `user` grant every account gets belongs to
    // `AssignDefaultRoleCommandHandler`, which the loop below runs for all of them.
    const user = await userRepo.findOneBy({ email: seedUser.email });
    const role = await roleRepo.findOneBy({ name: seedUser.role });
    if (user && role && seedUser.role !== ROLES.USER) {
      await userRoleRepository.assignRoleToUser(user.id, role.id, null);
    }

    console.log(`Created ${seedUser.role} user: ${seedUser.email}`);
  }

  // What sign-up owes every account: the default `user` role, and the personal
  // workspace — one organization, one owner member, no team. Run for all seed
  // accounts, not only the ones just created, so a database seeded before
  // either existed is repaired. Both handlers are idempotent.
  for (const seedUser of seedUsers) {
    const user = await userRepo.findOneBy({ email: seedUser.email });
    if (!user) continue;
    await assignDefaultRole.execute(new AssignDefaultRoleCommand({ userId: user.id }));
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
