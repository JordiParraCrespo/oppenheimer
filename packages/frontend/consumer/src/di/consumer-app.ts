import type { OppenheimerApp } from '@oppenheimer/frontend-core';
import type { ApiTokensService } from '../modules/api-tokens';
import { ApiTokensModule } from '../modules/api-tokens';
import type { HostsService } from '../modules/hosts';
import { HostsModule } from '../modules/hosts';
import type { InstallationsService } from '../modules/installations';
import { InstallationsModule } from '../modules/installations';
import type { OrganizationsService } from '../modules/organizations';
import { OrganizationsModule } from '../modules/organizations';
import type { ProfileService } from '../modules/profile';
import { ProfileModule } from '../modules/profile';
import type { SessionsService } from '../modules/sessions';
import { SessionsModule } from '../modules/sessions';
import { TOKENS } from './tokens';

/**
 * What a consumer app loads into `OppenheimerApp.create({ modules })`. Loading these
 * is what makes an app the consumer product.
 */
export const consumerModules = [
  SessionsModule,
  HostsModule,
  InstallationsModule,
  ApiTokensModule,
  OrganizationsModule,
  ProfileModule,
];

/**
 * The consumer product's services, resolved from the kernel container.
 *
 * `OppenheimerApp` only knows the kernel; the product's services are reached
 * through the container, and this wrapper is the one place that does so, so
 * the query hooks read `app.sessions` like they read `app.auth`.
 */
export class ConsumerApp {
  private static readonly instances = new WeakMap<OppenheimerApp, ConsumerApp>();

  private constructor(public readonly kernel: OppenheimerApp) {}

  static for(app: OppenheimerApp): ConsumerApp {
    let instance = ConsumerApp.instances.get(app);
    if (!instance) {
      instance = new ConsumerApp(app);
      ConsumerApp.instances.set(app, instance);
    }
    return instance;
  }

  get auth() {
    return this.kernel.auth;
  }

  get users() {
    return this.kernel.users;
  }

  /** The product: sessions on hosts the user owns. */
  get sessions(): SessionsService {
    return this.kernel.container.get(TOKENS.SessionsService);
  }

  get hosts(): HostsService {
    return this.kernel.container.get(TOKENS.HostsService);
  }

  /** The GitHub App installations this workspace has connected. */
  get installations(): InstallationsService {
    return this.kernel.container.get(TOKENS.InstallationsService);
  }

  get apiTokens(): ApiTokensService {
    return this.kernel.container.get(TOKENS.ApiTokensService);
  }

  get organizations(): OrganizationsService {
    return this.kernel.container.get(TOKENS.OrganizationsService);
  }

  get profile(): ProfileService {
    return this.kernel.container.get(TOKENS.ProfileService);
  }
}
