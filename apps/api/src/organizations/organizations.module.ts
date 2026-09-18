import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../auth/database/session.orm-entity';
import { AccessGrantOrmEntity } from '../authz/database/access-grant.orm-entity';
import { UserRoleOrmEntity } from '../roles/database/user-role.orm-entity';
import { UserOrmEntity } from '../users/database/user.orm-entity';
import { ProvisionPersonalWorkspaceCommandHandler } from './commands/provision-personal-workspace/provision-personal-workspace.command-handler';
import { InvitationOrmEntity } from './database/invitation.orm-entity';
import { MemberOrmEntity } from './database/member.orm-entity';
import { OrganizationOrmEntity } from './database/organization.orm-entity';
import { PersonalWorkspaceRepository } from './database/personal-workspace.repository';
import { InvitationsController, OrganizationInvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { MembersController } from './members.controller';
import { OrganizationsController } from './organizations.controller';
import { PERSONAL_WORKSPACE_REPOSITORY } from './organizations.di-tokens';
import { OrganizationsService } from './organizations.service';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

/**
 * First-class REST modules for organizations, members, invitations and
 * workspaces. These are **delegating façades** over the Better Auth organization
 * plugin's server API (`auth.api.*`) — Better Auth owns the tables and the
 * write logic; this module adds a typed, Swagger-documented, CASL-guarded
 * surface (so the operations appear in the generated `@oppenheimer/api-client`).
 *
 * The one exception is the personal workspace. That is the app's own rule, not
 * Better Auth's — the organization an account is given at sign-up, with the
 * org-scoped role that opens it — so it is a proper vertical slice: an
 * aggregate, a repository port and a command handler
 * (`commands/provision-personal-workspace/`), dispatched by the sign-up hook
 * through `auth/infrastructure/auth-command-bus.util.ts`.
 */
const commandHandlers: Provider[] = [ProvisionPersonalWorkspaceCommandHandler];

const repositories: Provider[] = [
  { provide: PERSONAL_WORKSPACE_REPOSITORY, useClass: PersonalWorkspaceRepository },
];

@Module({
  // The user repository enriches member rows with the account behind them;
  // the session and access-grant tables are what membership removal cleans up.
  imports: [
    // `UserRoleOrmEntity` is here so the members list can search on the roles a
    // member holds — the names the table puts in the Role column.
    CqrsModule,
    TypeOrmModule.forFeature([
      UserOrmEntity,
      UserRoleOrmEntity,
      InvitationOrmEntity,
      MemberOrmEntity,
      OrganizationOrmEntity,
      Session,
      AccessGrantOrmEntity,
    ]),
  ],
  controllers: [
    OrganizationsController,
    MembersController,
    OrganizationInvitationsController,
    InvitationsController,
    WorkspacesController,
  ],
  providers: [
    OrganizationsService,
    InvitationsService,
    WorkspacesService,
    ...commandHandlers,
    ...repositories,
  ],
})
export class OrganizationsModule {}
