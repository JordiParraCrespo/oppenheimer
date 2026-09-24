import 'reflect-metadata';
import { Container, type ContainerModule } from 'inversify';
import type { AnalyticsService } from '../modules/analytics';
import { AnalyticsModule } from '../modules/analytics';
import type { IAnalyticsClient } from '../modules/analytics/analytics.client';
import type { AuthService } from '../modules/auth';
import { AuthModule } from '../modules/auth';
import type { IAuthClient } from '../modules/auth/auth.client';
import type { CapabilitiesService } from '../modules/capabilities';
import { CapabilitiesModule } from '../modules/capabilities';
import { createCoreModule } from '../modules/core/core.module';
import type { IStorageService } from '../modules/core/storage.service';
import type { UserSettingsService } from '../modules/user-settings';
import { UserSettingsModule } from '../modules/user-settings';
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
  /**
   * The product's modules, such as `consumerModules` from
   * `@oppenheimer/frontend-consumer`. The kernel binds what every product shares (session, users, capabilities, analytics); the app
   * decides which product it is by what it loads here.
   */
  modules?: ContainerModule[];
}

export class OppenheimerApp {
  private constructor(public readonly container: Container) {}

  static create(config: OppenheimerAppConfig): OppenheimerApp {
    const container = new Container();

    // Core: storage + analytics client + API client
    container.load(createCoreModule(config));

    // Kernel modules, shared by every product
    container.load(AnalyticsModule);
    container.load(AuthModule);
    container.load(CapabilitiesModule);
    container.load(UsersModule);
    container.load(UserSettingsModule);

    // The product's modules, and anything else the app adds
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

  get users(): UsersService {
    return this.container.get(TOKENS.UsersService);
  }

  get userSettings(): UserSettingsService {
    return this.container.get(TOKENS.UserSettingsService);
  }

  get analytics(): AnalyticsService {
    return this.container.get(TOKENS.AnalyticsService);
  }

  get capabilities(): CapabilitiesService {
    return this.container.get(TOKENS.CapabilitiesService);
  }
}
