import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import type { ProjectUsagePort } from '../../projects/application/project-usage.port';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import { WORK_SESSION_REPOSITORY } from '../sessions.di-tokens';

/**
 * This module's answer to the one question archiving a project has to ask.
 *
 * `starting` and `failed` count as open: a launch that never finished and a session
 * that fell over both still have a directory on somebody's host, and retiring the
 * project's directory out from under either is exactly what the refusal exists for.
 *
 * It is contributed through `ProjectsModule.contributeUsage([...])` rather than
 * exported as a token, because the dependency only runs one way — a session needs
 * the project it belongs to, so `projects/` cannot import this module to inject it.
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
