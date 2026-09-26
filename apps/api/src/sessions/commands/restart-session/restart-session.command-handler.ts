import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { ProjectLookupPort } from '../../../projects/application/project-lookup.port';
import { PROJECT_LOOKUP } from '../../../projects/projects.di-tokens';
import { requireSessionHome } from '../../application/require-active-project.policy';
import type { SessionDispatchPort } from '../../application/session-dispatch.port';
import { SessionLaunchSpecFactory } from '../../application/session-launch.factory';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import type { SessionCommandResult } from '../../domain/session-command.types';
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
 * stopping, where the control plane's decision is itself the fact. One append, and
 * what could not be delivered is a hint on the response.
 */
@CommandHandler(RestartSessionCommand)
export class RestartSessionCommandHandler
  implements ICommandHandler<RestartSessionCommand, SessionCommandResult>
{
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(PROJECT_LOOKUP)
    private readonly projects: ProjectLookupPort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
    private readonly launches: SessionLaunchSpecFactory,
  ) {}

  async execute(command: RestartSessionCommand): Promise<SessionCommandResult> {
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

    // The tree is in the home project's directory, wherever the session is listed.
    const projectSlug = (await requireSessionHome(this.projects, command.scope, session)).slug;

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
    const { hints } = await this.dispatch.restart(
      session,
      await this.launches.build(session, projectSlug),
    );
    return { session, hints };
  }
}
