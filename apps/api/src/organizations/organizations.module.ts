import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../auth/entities/session.entity';
import { AccessGrantOrmEntity } from '../authz/database/access-grant.orm-entity';
import { UserRoleOrmEntity } from '../roles/database/user-role.orm-entity';
import { UserOrmEntity } from '../users/database/user.orm-entity';
import { InvitationOrmEntity } from './database/invitation.orm-entity';
import { MemberOrmEntity } from './database/member.orm-entity';
import { InvitationsController, OrganizationInvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { MembersController } from './members.controller';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

/**
 * First-class REST modules for organizations, members, invitations and
 * workspaces. These are **delegating façades** over the Better Auth organization
 * plugin's server API (`auth.api.*`) — Better Auth owns the tables and the
 * write logic; this module adds a typed, Swagger-documented, CASL-guarded
 * surface (so the operations appear in the generated `@oppenheimer/api-client`). No
 * TypeORM repositories here: the org tables are registered in `AuthModule`.
 */
@Module({
  // The user repository enriches member rows with the account behind them;
  // the session and access-grant tables are what membership removal cleans up.
  imports: [
    // `UserRoleOrmEntity` is here so the members list can search on the roles a
    // member holds — the names the table puts in the Role column.
    TypeOrmModule.forFeature([
      UserOrmEntity,
      UserRoleOrmEntity,
      InvitationOrmEntity,
      MemberOrmEntity,
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
  providers: [OrganizationsService, InvitationsService, WorkspacesService],
})
export class OrganizationsModule {}
