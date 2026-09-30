import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import { requireLaunchableHost } from '../../application/require-launchable-host.policy';
import { SessionAttachmentsResolver } from '../../application/session-attachments.resolver';
import { throwIfRefused } from '../../application/session-create-refusal.policy';
import type { SessionDispatchPort } from '../../application/session-dispatch.port';
import { SessionLaunchSpecFactory } from '../../application/session-launch.factory';
import { SessionNamingResolver } from '../../application/session-naming.resolver';
import { SessionPlanFactory } from '../../application/session-plan.factory';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import type { SessionCommandResult } from '../../domain/session-command.types';
import { mintSessionSlug } from '../../domain/session-slug.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { SESSION_DISPATCH, WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { WorkSessionMapper } from '../../work-session.mapper';
import { CreateSessionCommand } from './create-session.command';

/**
 * Starts a session: the project, the slug, the checkouts, the first entry of the
 * log, and the job the host is owed.
 *
 * The order matters. The host is checked **first**: `hostId` is the one reference
 * no composite key can scope (a host is a person's, with no workspace column), so a
 * foreign host is refused before anything is written; then the project, the
 * checkouts and the attached images. The row, its checkouts and its log commit
 * together, and only a session genuinely created is dispatched.
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
    private readonly launches: SessionLaunchSpecFactory,
    private readonly naming: SessionNamingResolver,
    private readonly mapper: WorkSessionMapper,
    private readonly attachments: SessionAttachmentsResolver,
  ) {}

  async execute(command: CreateSessionCommand): Promise<SessionCommandResult> {
    const { scope, input } = command;
    if (!scope.organizationId) throw new AppError(SessionErrors.NO_ACTIVE_ORGANIZATION);

    // A retry that already has a session gets that session, without touching
    // GitHub, the project or the host.
    if (command.idempotencyKey) {
      const existing = await this.sessions.findOneByIdempotencyKey(scope, command.idempotencyKey);
      if (existing.isSome()) return { sessionId: existing.unwrap().id, hints: [] };
    }

    await requireLaunchableHost(this.hosts, scope, input.hostId, input.agent);
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
      origin: command.origin,
    });

    for (const checkout of input.checkouts) {
      await this.plan.attachCheckout(scope, session, checkout);
    }
    // Before the row: a task that talks about a picture must not start without it.
    const images = await this.attachments.claim(scope, command.userId, session.id, input);

    const created = await this.sessions.createIfUnclaimed(
      session,
      this.mapper.toRequestEvents({
        commandId: command.id,
        userId: command.userId,
        input,
        images,
        checkouts: session.checkouts.length,
        cwdCheckoutId: this.plan.cwdCheckoutIdFor(session, input.cwdGithubRepoId),
      }),
    );
    throwIfRefused(created, { projectSlug: project.slug, hostId: input.hostId });
    if (!created.created) return { sessionId: created.session.id, hints: [] };

    // The name is asked for *while* the host is told about the session, so the
    // model's round trip overlaps the dispatch rather than following it.
    const naming = input.prompt ? this.naming.propose(created.session, input.prompt) : null;

    const { hints } = await this.dispatch.create(
      created.session,
      await this.launches.build(created.session, { prompt: input.prompt, images }),
    );

    await this.naming.record(
      created.session,
      await naming,
      WorkSessionMapper.promptKeyFor(command.id),
    );
    return { sessionId: created.session.id, hints };
  }
}
