import 'reflect-metadata';
import { Container, type ContainerModule } from 'inversify';
import type { AdminUsersService } from '../modules/admin-users';
import { AdminUsersModule } from '../modules/admin-users';
import type { AnalyticsService } from '../modules/analytics';
import { AnalyticsModule } from '../modules/analytics';
import type { IAnalyticsClient } from '../modules/analytics/analytics.client';
import type { ApiTokensService } from '../modules/api-tokens';
import { ApiTokensModule } from '../modules/api-tokens';
import type { AuthService } from '../modules/auth';
import { AuthModule } from '../modules/auth';
import type { IAuthClient } from '../modules/auth/auth.client';
import type { CapabilitiesService } from '../modules/capabilities';
import { CapabilitiesModule } from '../modules/capabilities';
import { createCoreModule } from '../modules/core/core.module';
import type { IStorageService } from '../modules/core/storage.service';
import type { OrganizationsService } from '../modules/organizations';
import { OrganizationsModule } from '../modules/organizations';
import type { ProfileService } from '../modules/profile';
import { ProfileModule } from '../modules/profile';
import type { RolesService } from '../modules/roles';
import { RolesModule } from '../modules/roles';
import type { UsersService } from '../modules/users';
import { UsersModule } from '../modules/users';
import { TOKENS } from './tokens';

export interface OppenheimerAppConfig {
  apiBaseUrl: string;
  storage: IStorageService;
  /** Platform-specific Better Auth client adapter. */
  authClient: IAuthClient;
  /**
   * Platform-specific analytics adapter. Omit it and the app runs against a
   * no-op client — events are dropped and every feature flag reads as off.
   */
  analytics?: IAnalyticsClient;
  modules?: ContainerModule[];
}

export class OppenheimerApp {
  private constructor(public readonly container: Container) {}

  static create(config: OppenheimerAppConfig): OppenheimerApp {
    const container = new Container();

    // Core: storage + analytics client + API client
    container.load(createCoreModule(config));

    // Feature modules
    container.load(AnalyticsModule);
    container.load(AdminUsersModule);
    container.load(AuthModule);
    container.load(CapabilitiesModule);
    container.load(UsersModule);
    container.load(ApiTokensModule);
    container.load(OrganizationsModule);
    container.load(RolesModule);
    container.load(ProfileModule);

    // Additional modules provided by the app
    if (config.modules) {
      for (const mod of config.modules) {
        container.load(mod);
      }
    }

    return new OppenheimerApp(container);
  }

  get auth(): AuthService {
    return this.container.get(TOKENS.AuthService);
  }

  get adminUsers(): AdminUsersService {
    return this.container.get(TOKENS.AdminUsersService);
  }

  get users(): UsersService {
    return this.container.get(TOKENS.UsersService);
  }

  get apiTokens(): ApiTokensService {
    return this.container.get(TOKENS.ApiTokensService);
  }

  get organizations(): OrganizationsService {
    return this.container.get(TOKENS.OrganizationsService);
  }

  get roles(): RolesService {
    return this.container.get(TOKENS.RolesService);
  }

  get profile(): ProfileService {
    return this.container.get(TOKENS.ProfileService);
  }

  get analytics(): AnalyticsService {
    return this.container.get(TOKENS.AnalyticsService);
  }

  get capabilities(): CapabilitiesService {
    return this.container.get(TOKENS.CapabilitiesService);
  }
}
