import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import { requireLaunchableHost } from '../../application/require-launchable-host.policy';
import { SessionAttachmentsResolver } from '../../application/session-attachments.resolver';
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
 * a constraint cannot hold (a host is a person's, with no workspace column), so a
 * foreign host is refused before anything is written; then the attached images,
 * then the project, whose slug the branch needs. The row, its checkouts and its log
 * commit together, and only a session genuinely created is dispatched.
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
    // Before the row: a task that talks about a picture must not start without it.
    const images = await this.attachments.resolve(scope, command.userId, input);
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

    const created = await this.sessions.createIfUnclaimed(
      session,
      this.mapper.toRequestEvents({
        commandId: command.id,
        userId: command.userId,
        input,
        checkouts: session.checkouts.length,
        cwdCheckoutId: this.plan.cwdCheckoutIdFor(session, input.cwdGithubRepoId),
      }),
    );
    // The project was retired between the lookup and the insert; the locked
    // project row decides that race rather than detecting it afterwards.
    if (created.projectArchived) {
      throw new AppError(SessionErrors.PROJECT_ARCHIVED, {
        detail: `Project ${project.slug} is archived`,
      });
    }
    if (!created.created) return { sessionId: created.session.id, hints: [] };

    // The name is asked for *while* the host is told about the session, so the
    // model's round trip overlaps the dispatch rather than following it. It
    // resolves within the namer's deadline and never rejects: a slow model is
    // replaced by the prompt's own words, so the response carries a readable name.
    const naming = input.prompt ? this.naming.propose(created.session, input.prompt) : null;

    const { hints } = await this.dispatch.create(
      created.session,
      await this.launches.build(created.session, { prompt: input.prompt, images }),
    );
    await this.attachments.release(input.attachmentIds);

    await this.naming.record(
      created.session,
      await naming,
      WorkSessionMapper.promptKeyFor(command.id),
    );
    return { sessionId: created.session.id, hints };
  }
}
