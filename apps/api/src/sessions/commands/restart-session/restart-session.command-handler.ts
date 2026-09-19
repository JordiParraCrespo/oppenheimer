import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { ProjectLookupPort } from '../../../projects/application/project-lookup.port';
import { PROJECT_LOOKUP } from '../../../projects/projects.di-tokens';
import type { SessionDispatchPort } from '../../application/session-dispatch.port';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { sessionBranchName } from '../../domain/session-layout.policy';
import { SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { SESSION_DISPATCH, WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { RestartSessionCommand } from './restart-session.command';

/**
 * Restarts a session in the worktrees it already has.
 *
 * This is what a host reboot needs: every session shows as stopped with a Restart
 * button, and pressing it recreates window 0 in the same directories rather than
 * building a second set. Nothing about the session's identity changes — same slug,
 * same directory, same branch — which is why the launch spec is derived rather than
 * stored.
 *
 * What it records is a **request**, not an outcome: the session becomes `open` when
 * the host says it did, not when somebody asked. That is the difference from
 * stopping, where the control plane's decision is itself the fact.
 */
@CommandHandler(RestartSessionCommand)
export class RestartSessionCommandHandler
  implements ICommandHandler<RestartSessionCommand, WorkSessionEntity>
{
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(PROJECT_LOOKUP)
    private readonly projects: ProjectLookupPort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
  ) {}

  async execute(command: RestartSessionCommand): Promise<WorkSessionEntity> {
    const found = await this.sessions.findOneById(command.scope, command.sessionId);
    if (found.isNone()) {
      throw new AppError(SessionErrors.NOT_FOUND, {
        detail: `No session with id ${command.sessionId}`,
      });
    }
    const session = found.unwrap();
    if (session.isResolved) {
      throw new AppError(SessionErrors.ALREADY_RESOLVED, {
        detail: `Session ${session.slug} is closed`,
      });
    }

    const project = await this.projects.findOneById(command.scope, session.projectId);
    if (project.isNone()) {
      throw new AppError(SessionErrors.PROJECT_ARCHIVED, {
        detail: `The project holding session ${session.slug} is archived`,
      });
    }
    const projectSlug = project.unwrap().slug;

    await this.dispatch.restart(session, {
      projectSlug,
      branch: sessionBranchName(projectSlug, session.slug),
    });
    await this.sessions.appendEvents(session, [
      {
        idempotencyKey: WorkSessionEntity.apiIdempotencyKey(
          command.id,
          SESSION_EVENT_KINDS.RESTART_REQUESTED,
        ),
        source: 'api',
        kind: SESSION_EVENT_KINDS.RESTART_REQUESTED,
        payload: { requestedBy: 'api' },
      },
    ]);
    return session;
  }
}
