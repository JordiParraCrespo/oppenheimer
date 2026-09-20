import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import type { SessionDispatchPort } from '../../application/session-dispatch.port';
import { SessionPlanFactory } from '../../application/session-plan.factory';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import type { SessionCommandResult } from '../../domain/session-command.types';
import { sessionBranchName } from '../../domain/session-layout.policy';
import { mintSessionSlug } from '../../domain/session-slug.policy';
import { SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { SESSION_DISPATCH, WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { CreateSessionCommand } from './create-session.command';

/**
 * Starts a session: the project, the slug, the checkouts, the first entry of the
 * log, and the job the host is owed.
 *
 * The order matters. The host is checked **first**, because `hostId` is the one
 * reference in the schema a constraint cannot hold — a host belongs to a person and
 * carries no workspace column — so a foreign host must be refused before anything is
 * written. The project comes next, because the branch name needs its slug. The row,
 * its checkouts and its log then commit together, and only a session that was
 * genuinely created is dispatched: a retry hands back the first one rather than
 * asking the host to build a second worktree.
 */
@CommandHandler(CreateSessionCommand)
export class CreateSessionCommandHandler
  implements ICommandHandler<CreateSessionCommand, SessionCommandResult>
{
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
    private readonly plan: SessionPlanFactory,
  ) {}

  async execute(command: CreateSessionCommand): Promise<SessionCommandResult> {
    const { scope, input } = command;
    if (!scope.organizationId) throw new AppError(SessionErrors.NO_ACTIVE_ORGANIZATION);

    // A retry that already has a session gets that session, without touching
    // GitHub, the project or the host.
    if (command.idempotencyKey) {
      const existing = await this.sessions.findOneByIdempotencyKey(scope, command.idempotencyKey);
      if (existing.isSome()) return { session: existing.unwrap(), hints: [] };
    }

    await this.hosts.assertUsable(scope, input.hostId);
    const project = await this.plan.resolveProject(scope, input);

    const session = WorkSessionEntity.request({
      organizationId: scope.organizationId,
      projectId: project.id,
      createdByUserId: command.userId,
      hostId: input.hostId,
      slug: mintSessionSlug(),
      agent: input.agent,
      name: input.name,
      idempotencyKey: command.idempotencyKey,
    });

    for (const checkout of input.checkouts) {
      await this.plan.attachCheckout(scope, session, project, checkout);
    }

    // Two entries, one transaction, one action: the request, and where the agent
    // runs. The second is an event rather than a column write because
    // `cwdCheckoutId` is part of the fold — a later "work in this checkout instead"
    // is the same entry, and a replay rebuilds it.
    const created = await this.sessions.createIfUnclaimed(session, [
      {
        idempotencyKey: WorkSessionEntity.apiIdempotencyKey(
          command.id,
          SESSION_EVENT_KINDS.REQUESTED,
        ),
        source: 'api',
        kind: SESSION_EVENT_KINDS.REQUESTED,
        payload: {
          agent: input.agent,
          hostId: input.hostId,
          checkouts: session.checkouts.length,
          requestedByUserId: command.userId,
        },
      },
      {
        idempotencyKey: WorkSessionEntity.apiIdempotencyKey(
          command.id,
          SESSION_EVENT_KINDS.CWD_SET,
        ),
        source: 'api',
        kind: SESSION_EVENT_KINDS.CWD_SET,
        payload: { checkoutId: this.plan.cwdCheckoutIdFor(session, input.cwdGithubRepoId) },
      },
    ]);
    // The project was retired between the lookup and the insert. The project row is
    // locked inside that transaction, so this is the race decided rather than
    // detected afterwards.
    if (created.projectArchived) {
      throw new AppError(SessionErrors.PROJECT_ARCHIVED, {
        detail: `Project ${project.slug} is archived`,
      });
    }
    if (!created.created) return { session: created.session, hints: [] };

    const { hints } = await this.dispatch.create(created.session, {
      projectSlug: project.slug,
      branch: sessionBranchName(project.slug, session.slug),
    });
    return { session: created.session, hints };
  }
}
