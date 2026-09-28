import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { ProjectLookupPort } from '../../../projects/application/project-lookup.port';
import { PROJECT_LOOKUP } from '../../../projects/projects.di-tokens';
import { requireActiveProject } from '../../application/require-active-project.policy';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import type { SessionCommandResult } from '../../domain/session-command.types';
import { SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { MoveSessionCommand } from './move-session.command';

/**
 * Lists a session under another project — an **entry in its log**, folded onto
 * `projectId`, like a rename.
 *
 * Nothing moves on disk and no host is told: a project is metadata, and a
 * session's directory and branch never name it, so this is the whole of a move
 * (`product/versions/mvp/10-api-modules-and-data-model.md`). There is no rule
 * about repositories: a session may work on any, in any project.
 */
@CommandHandler(MoveSessionCommand)
export class MoveSessionCommandHandler
  implements ICommandHandler<MoveSessionCommand, SessionCommandResult>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(PROJECT_LOOKUP)
    private readonly projects: ProjectLookupPort,
  ) {}

  async execute(command: MoveSessionCommand): Promise<SessionCommandResult> {
    const session = await this.loader.requireLive(command.scope, command.sessionId);
    // Already there: nothing to record, and a retry is not a conflict.
    if (session.projectId === command.projectId) return { sessionId: session.id, hints: [] };

    const target = await requireActiveProject(this.projects, command.scope, command.projectId);
    const outcome = await this.sessions.appendMove(session, target.id, [
      {
        idempotencyKey: WorkSessionEntity.apiIdempotencyKey(command.id, SESSION_EVENT_KINDS.MOVED),
        source: 'api',
        kind: SESSION_EVENT_KINDS.MOVED,
        payload: { from: session.projectId, to: target.id },
      },
    ]);
    if (outcome === 'project-archived') {
      throw new AppError(SessionErrors.PROJECT_ARCHIVED, {
        detail: `Project ${target.slug} is archived`,
      });
    }
    return { sessionId: session.id, hints: [] };
  }
}
