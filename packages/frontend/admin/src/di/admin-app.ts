import type { OppenheimerApp } from '@oppenheimer/frontend-core';
import type { AdminUsersService } from '../modules/admin-users';
import { AdminUsersModule } from '../modules/admin-users';
import type { RolesService } from '../modules/roles';
import { RolesModule } from '../modules/roles';
import { TOKENS } from './tokens';

/** What a control-plane app loads into `OppenheimerApp.create({ modules })`. */
export const adminModules = [AdminUsersModule, RolesModule];

/** The admin product's services, resolved from the kernel container. */
export class AdminApp {
  private static readonly instances = new WeakMap<OppenheimerApp, AdminApp>();

  private constructor(public readonly kernel: OppenheimerApp) {}

  static for(app: OppenheimerApp): AdminApp {
    let instance = AdminApp.instances.get(app);
    if (!instance) {
      instance = new AdminApp(app);
      AdminApp.instances.set(app, instance);
    }
    return instance;
  }

  get auth() {
    return this.kernel.auth;
  }

  get users() {
    return this.kernel.users;
  }

  get adminUsers(): AdminUsersService {
    return this.kernel.container.get(TOKENS.AdminUsersService);
  }

  get roles(): RolesService {
    return this.kernel.container.get(TOKENS.RolesService);
  }
}
