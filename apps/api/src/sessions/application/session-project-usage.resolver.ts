import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import type { ProjectUsagePort } from '../../projects/application/project-usage.port';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import { WORK_SESSION_REPOSITORY } from '../sessions.di-tokens';

/**
 * This module's answer to the one question archiving a project has to ask.
 *
 * `starting` and `failed` count as open: both still have a directory on somebody's
 * host, and retiring the project's directory under either is what the refusal is for.
 *
 * Contributed through `ProjectsModule.contributeUsage([...])` rather than exported as
 * a token: a session needs its project, so `projects/` cannot import this module.
 */
@Injectable()
export class SessionProjectUsage implements ProjectUsagePort {
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  async hasUnresolvedSessions(scope: AccessScope, projectId: string): Promise<boolean> {
    return (await this.sessions.countUnresolvedForProject(scope, projectId)) > 0;
  }
}
