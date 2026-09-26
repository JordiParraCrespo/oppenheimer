import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { MAX_SESSION_CHECKOUTS } from '@oppenheimer/shared';
import type { ProjectLookupPort } from '../../../projects/application/project-lookup.port';
import { PROJECT_LOOKUP } from '../../../projects/projects.di-tokens';
import { requireSessionHome } from '../../application/require-active-project.policy';
import type { SessionDispatchPort } from '../../application/session-dispatch.port';
import { SessionLaunchSpecFactory } from '../../application/session-launch.factory';
import { SessionPlanFactory } from '../../application/session-plan.factory';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import type { SessionCommandResult } from '../../domain/session-command.types';
import { SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { SESSION_DISPATCH, WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { AddCheckoutCommand } from './add-checkout.command';

/**
 * Adds a repository to a session that is already running.
 *
 * It exists because that is the shape Claude Code on the web already has, and
 * confining a second repository to the create screen would be a needless limit.
 * The new checkout takes the **same branch** as the session's others — the working
 * branch is the session's, always — and a directory name no checkout of this session
 * has ever used. One append: the row and its entry commit together, and what could
 * not be delivered to the host is a hint on the response.
 */
@CommandHandler(AddCheckoutCommand)
export class AddCheckoutCommandHandler
  implements ICommandHandler<AddCheckoutCommand, SessionCommandResult>
{
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(PROJECT_LOOKUP)
    private readonly projects: ProjectLookupPort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
    private readonly plan: SessionPlanFactory,
    private readonly launches: SessionLaunchSpecFactory,
  ) {}

  async execute(command: AddCheckoutCommand): Promise<SessionCommandResult> {
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
    // The partial unique on `(sessionId, githubRepoId) WHERE removedAt IS NULL`
    // says the same thing; saying it here is what turns a constraint violation
    // into a sentence about the repository the caller named.
    if (
      session.liveCheckouts.some(
        (checkout) => checkout.githubRepoId === String(command.input.githubRepoId),
      )
    ) {
      throw new AppError(SessionErrors.CHECKOUT_ALREADY_PRESENT, {
        detail: `Repository ${command.input.githubRepoId} is already checked out here`,
      });
    }

    if (session.liveCheckouts.length >= MAX_SESSION_CHECKOUTS) {
      throw new AppError(SessionErrors.ONE_REPOSITORY, {
        detail: `Session ${session.slug} already checks out a repository`,
      });
    }

    // The new worktree joins the others, in the home project's directory.
    const project = await requireSessionHome(this.projects, command.scope, session);

    const checkout = await this.plan.attachCheckout(command.scope, session, project, command.input);
    await this.sessions.insertCheckout(session, checkout, [
      {
        idempotencyKey: WorkSessionEntity.apiIdempotencyKey(
          command.id,
          SESSION_EVENT_KINDS.CHECKOUT_ADDED,
        ),
        source: 'api',
        kind: SESSION_EVENT_KINDS.CHECKOUT_ADDED,
        payload: {
          checkoutId: checkout.id,
          repositoryFullName: checkout.repositoryFullName,
          directoryName: checkout.directoryName,
        },
      },
    ]);
    const { hints } = await this.dispatch.addCheckout(
      session,
      checkout,
      await this.launches.build(session, project.slug, { branch: checkout.branch }),
    );
    return { session, hints };
  }
}
