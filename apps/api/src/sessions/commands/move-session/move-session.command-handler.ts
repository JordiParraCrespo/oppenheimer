import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { ProjectLookupPort } from '../../../projects/application/project-lookup.port';
import { PROJECT_LOOKUP } from '../../../projects/projects.di-tokens';
import { requireActiveProject } from '../../application/require-active-project.policy';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import type { SessionCommandResult } from '../../domain/session-command.types';
import { SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { MoveSessionCommand } from './move-session.command';

/**
 * Move a session to another project (`product/versions/mvp/12-projects-on-the-console.md`).
 *
 * Only a project that holds every repository the session checked out can take
 * it — the move dialog says so and this is what holds it to that. Nothing on
 * a host changes: the branch and the worktree stay where they are, because the
 * directory carries the slug of the project that created it and a path is
 * never an identity. So, like a rename, the move is one event the row folds
 * and no host is told.
 */
@CommandHandler(MoveSessionCommand)
export class MoveSessionCommandHandler
  implements ICommandHandler<MoveSessionCommand, SessionCommandResult>
{
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(PROJECT_LOOKUP)
    private readonly projects: ProjectLookupPort,
  ) {}

  async execute(command: MoveSessionCommand): Promise<SessionCommandResult> {
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
    // Already there: a retried request after a lost response is not a change.
    if (session.projectId === command.projectId) return { session, hints: [] };

    const project = await requireActiveProject(this.projects, command.scope, command.projectId);
    const missing = session.liveCheckouts.find(
      (checkout) => !project.includesRepository(checkout.githubRepoId),
    );
    if (missing) {
      throw new AppError(SessionErrors.PROJECT_LACKS_REPOSITORY, {
        detail: `Project ${project.slug} does not include ${missing.repositoryFullName}`,
      });
    }

    await this.sessions.appendEvents(session, [
      {
        idempotencyKey: WorkSessionEntity.apiIdempotencyKey(command.id, SESSION_EVENT_KINDS.MOVED),
        source: 'api',
        kind: SESSION_EVENT_KINDS.MOVED,
        payload: { projectId: project.id, fromProjectId: session.projectId },
      },
    ]);
    return { session, hints: [] };
  }
}
