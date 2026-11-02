import { randomUUID } from 'node:crypto';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { CLOUD_PROVIDER_AGENT } from '@oppenheimer/shared';
import type { CloudRunsPort } from '../../../cloud-agents/application/cloud-runs.port';
import { CLOUD_RUNS } from '../../../cloud-agents/cloud-agents.di-tokens';
import { throwIfRefused } from '../../application/session-create-refusal.policy';
import { SessionNamingResolver } from '../../application/session-naming.resolver';
import { SessionPlanFactory } from '../../application/session-plan.factory';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import type { SessionCommandResult } from '../../domain/session-command.types';
import {
  cloudRequestEntries,
  cloudRunEntries,
  firstPromptKey,
} from '../../domain/session-log-entry.factory';
import { mintSessionSlug } from '../../domain/session-slug.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { SessionCloudRunMapper } from '../../session-cloud-run.mapper';
import { WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { StartCloudSessionCommand } from './start-cloud-session.command';

/**
 * Starts a session in a vendor's cloud (`product/next-steps/cloud-agents.md`):
 * the vendor's agent on one repository, on the caller's own key, listed under
 * a project like any session.
 *
 * The vendor is asked **first**, under the session's id, and the row is
 * written only once it said yes: a refusal (no key, a repository it cannot
 * reach, a plan out of usage) is the caller's answer with nothing stored. The
 * row, its vendor half and its first entries — the request, the task, and
 * what the vendor said about the run it started — then commit together. A
 * retry with the same `Idempotency-Key` returns the session already there.
 */
@CommandHandler(StartCloudSessionCommand)
export class StartCloudSessionCommandHandler
  implements ICommandHandler<StartCloudSessionCommand, SessionCommandResult>
{
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(CLOUD_RUNS)
    private readonly runs: CloudRunsPort,
    private readonly plan: SessionPlanFactory,
    private readonly naming: SessionNamingResolver,
  ) {}

  async execute(command: StartCloudSessionCommand): Promise<SessionCommandResult> {
    const { scope, input } = command;
    if (!scope.organizationId) throw new AppError(SessionErrors.NO_ACTIVE_ORGANIZATION);

    if (command.idempotencyKey) {
      const existing = await this.sessions.findOneByIdempotencyKey(scope, command.idempotencyKey);
      if (existing.isSome()) return { sessionId: existing.unwrap().id, hints: [] };
    }

    const project = await this.plan.resolveProject(scope, input);
    const source = await this.plan.cloudSourceOf(scope, input.checkout);
    const id = randomUUID();
    const owner = { organizationId: scope.organizationId, userId: command.userId };
    const launched = await this.runs.launch(
      owner,
      input.provider,
      SessionCloudRunMapper.toLaunch(id, input, source),
    );

    const now = new Date();
    const agent = CLOUD_PROVIDER_AGENT[input.provider];
    const session = WorkSessionEntity.requestCloud({
      id,
      cloudRun: SessionCloudRunMapper.toLaunched(
        { id, organizationId: scope.organizationId },
        input,
        launched,
        source.repositoryUrl,
        now,
      ),
      organizationId: scope.organizationId,
      projectId: project.id,
      createdByUserId: command.userId,
      slug: mintSessionSlug(),
      agent,
      name: input.name,
      idempotencyKey: command.idempotencyKey,
      origin: command.origin,
    });

    const created = await this.sessions.createIfUnclaimed(session, [
      ...cloudRequestEntries({
        commandId: command.id,
        userId: command.userId,
        agent,
        input,
      }),
      ...cloudRunEntries(launched.run, now),
    ]);
    throwIfRefused(created, { projectSlug: project.slug, hostId: null });
    if (!created.created) return { sessionId: created.session.id, hints: [] };

    await this.naming.record(
      created.session,
      await this.naming.propose(created.session, input.prompt),
      firstPromptKey(command.id),
    );
    return { sessionId: created.session.id, hints: [] };
  }
}
