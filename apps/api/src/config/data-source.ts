import '@oppenheimer/env/load';
import { OutboxMessageSchema } from '@oppenheimer/backend-ddd';
import { DataSource } from 'typeorm';
import { ApiTokenOrmEntity } from '../api-tokens/database/api-token.orm-entity';
import { Account } from '../auth/database/account.orm-entity';
import { OAuthAccessTokenOrmEntity } from '../auth/database/oauth-access-token.orm-entity';
import { OAuthApplicationOrmEntity } from '../auth/database/oauth-application.orm-entity';
import { OAuthConsentOrmEntity } from '../auth/database/oauth-consent.orm-entity';
import { Session } from '../auth/database/session.orm-entity';
import { Verification } from '../auth/database/verification.orm-entity';
import { AccessGrantOrmEntity } from '../authz/database/access-grant.orm-entity';
import { FeatureFlagOrmEntity } from '../feature-flags/database/feature-flag.orm-entity';
import { FlagChangeOrmEntity } from '../feature-flags/database/flag-change.orm-entity';
import { FlagSegmentOrmEntity } from '../feature-flags/database/flag-segment.orm-entity';
import { GithubInstallationOrmEntity } from '../github/database/github-installation.orm-entity';
import { HostOrmEntity } from '../hosts/database/host.orm-entity';
import { HostEventOrmEntity } from '../hosts/database/host-event.orm-entity';
import { HostInventoryOrmEntity } from '../hosts/database/host-inventory.orm-entity';
import { HostNetworkOrmEntity } from '../hosts/database/host-network.orm-entity';
import { HostPairingTokenOrmEntity } from '../hosts/database/host-pairing-token.orm-entity';
import { HostPresenceOrmEntity } from '../hosts/database/host-presence.orm-entity';
import { InvitationOrmEntity } from '../organizations/database/invitation.orm-entity';
import { MemberOrmEntity } from '../organizations/database/member.orm-entity';
import { OrganizationOrmEntity } from '../organizations/database/organization.orm-entity';
import { TeamOrmEntity } from '../organizations/database/team.orm-entity';
import { TeamMemberOrmEntity } from '../organizations/database/team-member.orm-entity';
import { UserSettingsOrmEntity } from '../profile/database/user-settings.orm-entity';
import { ProjectOrmEntity } from '../projects/database/project.orm-entity';
import { RoleOrmEntity } from '../roles/database/role.orm-entity';
import { UserRoleOrmEntity } from '../roles/database/user-role.orm-entity';
import { SessionCheckoutOrmEntity } from '../sessions/database/session-checkout.orm-entity';
import { WorkSessionOrmEntity } from '../sessions/database/work-session.orm-entity';
import { WorkSessionEventOrmEntity } from '../sessions/database/work-session-event.orm-entity';
import { UserOrmEntity } from '../users/database/user.orm-entity';

/**
 * Data source used by the TypeORM CLI (`migration:generate` / `migration:run` /
 * `migration:revert`). The runtime app configures TypeORM in `AppModule`.
 *
 * The migrations glob is resolved relative to this file so it works both when
 * run through ts-node (`src/`) and from the compiled output (`dist/`).
 */
export default new DataSource({
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
    GithubInstallationOrmEntity,
    ProjectOrmEntity,
    HostOrmEntity,
    HostPairingTokenOrmEntity,
    HostInventoryOrmEntity,
    HostPresenceOrmEntity,
    HostNetworkOrmEntity,
    HostEventOrmEntity,
    WorkSessionOrmEntity,
    SessionCheckoutOrmEntity,
    WorkSessionEventOrmEntity,
    UserRoleOrmEntity,
    OrganizationOrmEntity,
    MemberOrmEntity,
    InvitationOrmEntity,
    TeamOrmEntity,
    TeamMemberOrmEntity,
    FeatureFlagOrmEntity,
    FlagSegmentOrmEntity,
    FlagChangeOrmEntity,
    OutboxMessageSchema,
  ],
  migrations: [`${__dirname}/../migrations/*{.ts,.js}`],
});
