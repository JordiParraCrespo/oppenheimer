import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../auth/database/session.orm-entity';
import { AccessGrantOrmEntity } from '../authz/database/access-grant.orm-entity';
import { UserRoleOrmEntity } from '../roles/database/user-role.orm-entity';
import { UserOrmEntity } from '../users/database/user.orm-entity';
import { UsersModule } from '../users/user.module';
import { MembershipAccessPolicy } from './application/membership-access.policy';
import { WorkspaceAccountErasure } from './application/workspace-account-erasure.resolver';
import { AcceptInvitationCommandHandler } from './commands/accept-invitation/accept-invitation.command-handler';
import { AcceptInvitationHttpController } from './commands/accept-invitation/accept-invitation.http.controller';
import { AddMemberCommandHandler } from './commands/add-member/add-member.command-handler';
import { AddMemberHttpController } from './commands/add-member/add-member.http.controller';
import { AddWorkspaceMemberCommandHandler } from './commands/add-workspace-member/add-workspace-member.command-handler';
import { AddWorkspaceMemberHttpController } from './commands/add-workspace-member/add-workspace-member.http.controller';
import { CancelInvitationCommandHandler } from './commands/cancel-invitation/cancel-invitation.command-handler';
import { CancelInvitationHttpController } from './commands/cancel-invitation/cancel-invitation.http.controller';
import { CreateOrganizationCommandHandler } from './commands/create-organization/create-organization.command-handler';
import { CreateOrganizationHttpController } from './commands/create-organization/create-organization.http.controller';
import { CreateWorkspaceCommandHandler } from './commands/create-workspace/create-workspace.command-handler';
import { CreateWorkspaceHttpController } from './commands/create-workspace/create-workspace.http.controller';
import { DeleteOrganizationCommandHandler } from './commands/delete-organization/delete-organization.command-handler';
import { DeleteOrganizationHttpController } from './commands/delete-organization/delete-organization.http.controller';
import { DeleteWorkspaceCommandHandler } from './commands/delete-workspace/delete-workspace.command-handler';
import { DeleteWorkspaceHttpController } from './commands/delete-workspace/delete-workspace.http.controller';
import { InviteMemberCommandHandler } from './commands/invite-member/invite-member.command-handler';
import { InviteMemberHttpController } from './commands/invite-member/invite-member.http.controller';
import { LeaveOrganizationCommandHandler } from './commands/leave-organization/leave-organization.command-handler';
import { LeaveOrganizationHttpController } from './commands/leave-organization/leave-organization.http.controller';
import { ProvisionPersonalWorkspaceCommandHandler } from './commands/provision-personal-workspace/provision-personal-workspace.command-handler';
import { RejectInvitationCommandHandler } from './commands/reject-invitation/reject-invitation.command-handler';
import { RejectInvitationHttpController } from './commands/reject-invitation/reject-invitation.http.controller';
import { RemoveMemberCommandHandler } from './commands/remove-member/remove-member.command-handler';
import { RemoveMemberHttpController } from './commands/remove-member/remove-member.http.controller';
import { RemoveWorkspaceMemberCommandHandler } from './commands/remove-workspace-member/remove-workspace-member.command-handler';
import { RemoveWorkspaceMemberHttpController } from './commands/remove-workspace-member/remove-workspace-member.http.controller';
import { RenameWorkspaceCommandHandler } from './commands/rename-workspace/rename-workspace.command-handler';
import { RenameWorkspaceHttpController } from './commands/rename-workspace/rename-workspace.http.controller';
import { SetActiveOrganizationCommandHandler } from './commands/set-active-organization/set-active-organization.command-handler';
import { SetActiveOrganizationHttpController } from './commands/set-active-organization/set-active-organization.http.controller';
import { SetActiveWorkspaceCommandHandler } from './commands/set-active-workspace/set-active-workspace.command-handler';
import { SetActiveWorkspaceHttpController } from './commands/set-active-workspace/set-active-workspace.http.controller';
import { UpdateMemberRoleCommandHandler } from './commands/update-member-role/update-member-role.command-handler';
import { UpdateMemberRoleHttpController } from './commands/update-member-role/update-member-role.http.controller';
import { UpdateOrganizationCommandHandler } from './commands/update-organization/update-organization.command-handler';
import { UpdateOrganizationHttpController } from './commands/update-organization/update-organization.http.controller';
import { InvitationOrmEntity } from './database/invitation.orm-entity';
import { InvitationRepository } from './database/invitation.repository';
import { MemberOrmEntity } from './database/member.orm-entity';
import { MemberRepository } from './database/member.repository';
import { OrganizationOrmEntity } from './database/organization.orm-entity';
import { OrganizationRepository } from './database/organization.repository';
import { OrganizationAccessRepository } from './database/organization-access.repository';
import { PersonalWorkspaceRepository } from './database/personal-workspace.repository';
import { TeamOrmEntity } from './database/team.orm-entity';
import { TeamMemberOrmEntity } from './database/team-member.orm-entity';
import { WorkspaceLookupRepository } from './database/workspace-lookup.repository';
import { InvitationAuthGateway } from './infrastructure/invitation-auth.gateway';
import { OrganizationAuthGateway } from './infrastructure/organization-auth.gateway';
import { WorkspaceAuthGateway } from './infrastructure/workspace-auth.gateway';
import {
  INVITATION_AUTH,
  INVITATION_REPOSITORY,
  MEMBER_REPOSITORY,
  ORGANIZATION_ACCESS,
  ORGANIZATION_AUTH,
  ORGANIZATION_REPOSITORY,
  PERSONAL_WORKSPACE_REPOSITORY,
  WORKSPACE_AUTH,
  WORKSPACE_LOOKUP,
} from './organizations.di-tokens';
import { CheckSlugHttpController } from './queries/check-slug/check-slug.http.controller';
import { CheckSlugQueryHandler } from './queries/check-slug/check-slug.query-handler';
import { FindInvitationQueryHandler } from './queries/find-invitation/find-invitation.query-handler';
import { FindMemberQueryHandler } from './queries/find-member/find-member.query-handler';
import { FindOrganizationQueryHandler } from './queries/find-organization/find-organization.query-handler';
import { FindWorkspaceQueryHandler } from './queries/find-workspace/find-workspace.query-handler';
import { FindWorkspaceMemberQueryHandler } from './queries/find-workspace-member/find-workspace-member.query-handler';
import { GetInvitationHttpController } from './queries/get-invitation/get-invitation.http.controller';
import { GetInvitationQueryHandler } from './queries/get-invitation/get-invitation.query-handler';
import { GetMembershipHttpController } from './queries/get-membership/get-membership.http.controller';
import { GetMembershipQueryHandler } from './queries/get-membership/get-membership.query-handler';
import { GetOrganizationHttpController } from './queries/get-organization/get-organization.http.controller';
import { GetOrganizationQueryHandler } from './queries/get-organization/get-organization.query-handler';
import { ListMembersHttpController } from './queries/list-members/list-members.http.controller';
import { ListMembersQueryHandler } from './queries/list-members/list-members.query-handler';
import { ListMyInvitationsHttpController } from './queries/list-my-invitations/list-my-invitations.http.controller';
import { ListMyInvitationsQueryHandler } from './queries/list-my-invitations/list-my-invitations.query-handler';
import { ListMyWorkspacesHttpController } from './queries/list-my-workspaces/list-my-workspaces.http.controller';
import { ListMyWorkspacesQueryHandler } from './queries/list-my-workspaces/list-my-workspaces.query-handler';
import { ListOrganizationInvitationsHttpController } from './queries/list-organization-invitations/list-organization-invitations.http.controller';
import { ListOrganizationInvitationsQueryHandler } from './queries/list-organization-invitations/list-organization-invitations.query-handler';
import { ListOrganizationsHttpController } from './queries/list-organizations/list-organizations.http.controller';
import { ListOrganizationsQueryHandler } from './queries/list-organizations/list-organizations.query-handler';
import { ListWorkspaceMembersHttpController } from './queries/list-workspace-members/list-workspace-members.http.controller';
import { ListWorkspaceMembersQueryHandler } from './queries/list-workspace-members/list-workspace-members.query-handler';
import { ListWorkspacesHttpController } from './queries/list-workspaces/list-workspaces.http.controller';
import { ListWorkspacesQueryHandler } from './queries/list-workspaces/list-workspaces.query-handler';

// Registration order is the order routes are matched and documented in: each
// group's static segments (`check-slug`, `members/me`, `workspaces/mine`) ahead
// of the parameterized routes beside them.
const httpControllers = [
  CreateOrganizationHttpController,
  ListOrganizationsHttpController,
  CheckSlugHttpController,
  GetOrganizationHttpController,
  UpdateOrganizationHttpController,
  DeleteOrganizationHttpController,
  SetActiveOrganizationHttpController,
  GetMembershipHttpController,
  ListMembersHttpController,
  AddMemberHttpController,
  UpdateMemberRoleHttpController,
  RemoveMemberHttpController,
  LeaveOrganizationHttpController,
  InviteMemberHttpController,
  ListOrganizationInvitationsHttpController,
  ListMyInvitationsHttpController,
  GetInvitationHttpController,
  AcceptInvitationHttpController,
  RejectInvitationHttpController,
  CancelInvitationHttpController,
  ListMyWorkspacesHttpController,
  ListWorkspacesHttpController,
  CreateWorkspaceHttpController,
  RenameWorkspaceHttpController,
  DeleteWorkspaceHttpController,
  SetActiveWorkspaceHttpController,
  ListWorkspaceMembersHttpController,
  AddWorkspaceMemberHttpController,
  RemoveWorkspaceMemberHttpController,
];

const commandHandlers: Provider[] = [
  CreateOrganizationCommandHandler,
  UpdateOrganizationCommandHandler,
  DeleteOrganizationCommandHandler,
  SetActiveOrganizationCommandHandler,
  AddMemberCommandHandler,
  UpdateMemberRoleCommandHandler,
  RemoveMemberCommandHandler,
  LeaveOrganizationCommandHandler,
  InviteMemberCommandHandler,
  AcceptInvitationCommandHandler,
  RejectInvitationCommandHandler,
  CancelInvitationCommandHandler,
  CreateWorkspaceCommandHandler,
  RenameWorkspaceCommandHandler,
  DeleteWorkspaceCommandHandler,
  SetActiveWorkspaceCommandHandler,
  AddWorkspaceMemberCommandHandler,
  RemoveWorkspaceMemberCommandHandler,
  ProvisionPersonalWorkspaceCommandHandler,
];

const queryHandlers: Provider[] = [
  FindOrganizationQueryHandler,
  FindMemberQueryHandler,
  FindInvitationQueryHandler,
  FindWorkspaceQueryHandler,
  FindWorkspaceMemberQueryHandler,
  ListOrganizationsQueryHandler,
  CheckSlugQueryHandler,
  GetOrganizationQueryHandler,
  ListMembersQueryHandler,
  ListOrganizationInvitationsQueryHandler,
  ListMyInvitationsQueryHandler,
  GetInvitationQueryHandler,
  ListMyWorkspacesQueryHandler,
  ListWorkspacesQueryHandler,
  ListWorkspaceMembersQueryHandler,
  GetMembershipQueryHandler,
];

const repositories: Provider[] = [
  { provide: PERSONAL_WORKSPACE_REPOSITORY, useClass: PersonalWorkspaceRepository },
  { provide: WORKSPACE_LOOKUP, useClass: WorkspaceLookupRepository },
  { provide: MEMBER_REPOSITORY, useClass: MemberRepository },
  { provide: INVITATION_REPOSITORY, useClass: InvitationRepository },
  { provide: ORGANIZATION_ACCESS, useClass: OrganizationAccessRepository },
  { provide: ORGANIZATION_REPOSITORY, useClass: OrganizationRepository },
];

// Better Auth's organization plugin, bound once to the tokens its ports are
// named by: a handler names the port, never the gateway.
const adapters: Provider[] = [
  { provide: ORGANIZATION_AUTH, useClass: OrganizationAuthGateway },
  { provide: INVITATION_AUTH, useClass: InvitationAuthGateway },
  { provide: WORKSPACE_AUTH, useClass: WorkspaceAuthGateway },
];

/**
 * Organizations, their members and invitations, and workspaces (Better Auth
 * teams). Better Auth's organization plugin owns these tables and their
 * writes, so most of the module is a port per plugin part
 * (`infrastructure/*-auth.port.ts`), a gateway over `auth.api.*` and a slice
 * per operation. The app's own rules: `MembershipAccessPolicy` keeps
 * application roles aligned with the roster, and the personal workspace is an
 * aggregate provisioned by `commands/provision-personal-workspace/`, dispatched
 * by the sign-up hook through `auth/infrastructure/auth-command-bus.util.ts`.
 */
@Module({
  imports: [
    CqrsModule,
    // The account behind each member row, the roles they hold (so the members
    // list can search on them), the organization and team rows a write is read
    // back from, and the session and access-grant tables that membership
    // removal cleans up.
    TypeOrmModule.forFeature([
      UserOrmEntity,
      UserRoleOrmEntity,
      InvitationOrmEntity,
      MemberOrmEntity,
      OrganizationOrmEntity,
      TeamOrmEntity,
      TeamMemberOrmEntity,
      Session,
      AccessGrantOrmEntity,
    ]),
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...repositories,
    ...adapters,
    MembershipAccessPolicy,
    ...UsersModule.contributeAccountErasure([WorkspaceAccountErasure]),
  ],
  // The one published port: two facts about a workspace, for the modules that
  // put its slug on a host or re-check a membership at a socket. The tables
  // stay inside.
  exports: [WORKSPACE_LOOKUP],
})
export class OrganizationsModule {}
