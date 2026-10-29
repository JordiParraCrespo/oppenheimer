import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { placeOfCreate } from '@oppenheimer/shared';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import type { LinkRegistryPort } from '../../../links/application/link-registry.port';
import { LINK_REGISTRY } from '../../../links/links.di-tokens';
import { CloudAttachmentsResolver } from '../../application/cloud-attachments.resolver';
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
 * Starts a session: the project, the slug, the checkouts, the log's first entry, the host's job.
 *
 * The order matters. The host is checked **first**, before anything is written: `hostId` is
 * the one reference no composite key can scope. Then the project, the checkouts and the files
 * (parked for the host, or kept for a cloud session's agent); the row and its log commit as one.
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
    private readonly cloudAttachments: CloudAttachmentsResolver,
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
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

    await requireLaunchableHost(this.hosts, this.links, scope, input);
    const project = await this.plan.resolveProject(scope, input);

    const session = WorkSessionEntity.request({
      organizationId: scope.organizationId,
      projectId: project.id,
      createdByUserId: command.userId,
      hostId: input.hostId,
      slug: mintSessionSlug(),
      agent: input.agent,
      place: placeOfCreate(input),
      folder: input.folder,
      name: input.name,
      idempotencyKey: command.idempotencyKey,
      origin: command.origin,
    });

    for (const checkout of input.checkouts) {
      await this.plan.attachCheckout(scope, session, checkout);
    }
    // Before the row: a task that talks about a picture must not start without it.
    const files = input.cloud ? this.cloudAttachments : this.attachments;
    const images = await files.claim(scope, command.userId, session.id, input);

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
