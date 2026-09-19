import { Injectable } from '@nestjs/common';
import type { ProjectUsagePort, ProjectUsageRegistrarPort } from './project-usage.port';

/**
 * Resolves **who** answers "is this project still in use", which is a different
 * module every time this one is composed differently.
 *
 * It is a registry rather than a plain provider because the dependency has to run
 * the other way: `sessions/` imports `projects/` — it needs the project a session
 * belongs to — so `projects/` cannot import `sessions/` to inject a port from it.
 * `ProjectsModule.contributeUsage([...])` lets the contributor register on boot,
 * exactly as `AuthzModule.forFeature([...])` lets a module contribute its resource
 * to the kernel, and nothing has to be `@Global` for it.
 *
 * `current()` returning `undefined` is the fail-closed case and the only one: a
 * deployment built without sessions cannot archive a project, because nothing can
 * say whether archiving it would strand work.
 */
@Injectable()
export class ProjectUsageResolver implements ProjectUsageRegistrarPort {
  private usage: ProjectUsagePort | undefined;

  register(usage: ProjectUsagePort): void {
    this.usage = usage;
  }

  /** `undefined` is the fail-closed case, and the only one. */
  current(): ProjectUsagePort | undefined {
    return this.usage;
  }
}
