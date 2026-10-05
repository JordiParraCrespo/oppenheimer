import type { OppenheimerApp } from '@oppenheimer/frontend-core';
import type { AutomationsRepository } from '../modules/automations';
import { AutomationsModule } from '../modules/automations';
import type { CalendarRepository } from '../modules/calendar';
import { CalendarModule } from '../modules/calendar';
import type { HostsRepository } from '../modules/hosts';
import { HostsModule } from '../modules/hosts';
import type { InstallationsRepository } from '../modules/installations';
import { InstallationsModule } from '../modules/installations';
import type { OrganizationsService } from '../modules/organizations';
import { OrganizationsModule } from '../modules/organizations';
import type { PermissionsRepository } from '../modules/permissions';
import { PermissionsModule } from '../modules/permissions';
import type { ProfileService } from '../modules/profile';
import { ProfileModule } from '../modules/profile';
import type { ProjectsRepository } from '../modules/projects';
import { ProjectsModule } from '../modules/projects';
import type { SessionsService } from '../modules/sessions';
import { SessionsModule } from '../modules/sessions';
import type { TasksRepository } from '../modules/tasks';
import { TasksModule } from '../modules/tasks';
import { TOKENS } from './tokens';

/**
 * What a consumer app loads into `OppenheimerApp.create({ modules })`. Loading these
 * is what makes an app the consumer product.
 */
export const consumerModules = [
  SessionsModule,
  ProjectsModule,
  AutomationsModule,
  TasksModule,
  CalendarModule,
  HostsModule,
  InstallationsModule,
  PermissionsModule,
  OrganizationsModule,
  ProfileModule,
];

/**
 * The consumer product's modules, resolved from the kernel container: a
 * module's service where it has a use case to hold (sessions, profile,
 * organizations), its repository where it has none.
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

  /** The bodies of work sessions belong to, and what New session is prefilled with. */
  get projects(): ProjectsRepository {
    return this.kernel.container.get(TOKENS.ProjectsRepository);
  }

  /** Saved prompts that start sessions on a schedule or an event, and the runs they made. */
  get automations(): AutomationsRepository {
    return this.kernel.container.get(TOKENS.AutomationsRepository);
  }

  /** Plan's board: tasks, the goals over them, and the sessions a task started or links. */
  get tasks(): TasksRepository {
    return this.kernel.container.get(TOKENS.TasksRepository);
  }

  /** Plan's calendar: the workspace's events and the viewer's Google Calendar. */
  get calendar(): CalendarRepository {
    return this.kernel.container.get(TOKENS.CalendarRepository);
  }

  get hosts(): HostsRepository {
    return this.kernel.container.get(TOKENS.HostsRepository);
  }

  /** The GitHub App installations this workspace has connected. */
  get installations(): InstallationsRepository {
    return this.kernel.container.get(TOKENS.InstallationsRepository);
  }

  /** The permission catalog OAuth consent names scopes from. */
  get permissions(): PermissionsRepository {
    return this.kernel.container.get(TOKENS.PermissionsRepository);
  }

  get organizations(): OrganizationsService {
    return this.kernel.container.get(TOKENS.OrganizationsService);
  }

  get profile(): ProfileService {
    return this.kernel.container.get(TOKENS.ProfileService);
  }
}
