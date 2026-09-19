import { Injectable } from '@nestjs/common';
import type { ProjectUsagePort } from './project-usage.port';

/**
 * What the running application can say a project is still being used for,
 * collected at boot.
 *
 * Archiving a project has to refuse while work is still going on inside its
 * directory, and this module cannot answer that: sessions are somebody else's
 * aggregate, and the dependency only runs one way — a session needs the project it
 * belongs to. So the question is a port this module declares and another module
 * contributes an implementation of, through
 * {@link ProjectsModule.contributeUsage}.
 *
 * An empty registry is the **fail-closed** case and the only one: a deployment
 * built without the module that owns sessions cannot archive a project, because
 * nothing can say whether archiving it would strand work. That is a DI fact, not a
 * fallback to catch.
 */
@Injectable()
export class ProjectUsageRegistry {
  private readonly usages: ProjectUsagePort[] = [];

  register(usage: ProjectUsagePort): void {
    if (this.usages.includes(usage)) return;
    this.usages.push(usage);
  }

  registerAll(usages: readonly ProjectUsagePort[]): void {
    for (const usage of usages) this.register(usage);
  }

  /**
   * Whether **anything** still holds the project. Every contribution is asked, and
   * the first yes is enough: a project is in use if any of them says so, so adding
   * a second kind of work later narrows nothing by accident.
   */
  async isInUse(...args: Parameters<ProjectUsagePort['hasUnresolvedSessions']>): Promise<boolean> {
    for (const usage of this.usages) {
      if (await usage.hasUnresolvedSessions(...args)) return true;
    }
    return false;
  }

  /** Empty means nothing can answer, which is what makes the archive refuse. */
  canAnswer(): boolean {
    return this.usages.length > 0;
  }
}
