import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import type { ProjectLookupPort } from '../../../projects/application/project-lookup.port';
import { PROJECT_LOOKUP } from '../../../projects/projects.di-tokens';
import { requireActiveProject } from '../../application/require-active-project.policy';
import type { SessionDispatchPort } from '../../application/session-dispatch.port';
import { SessionLaunchSpecFactory } from '../../application/session-launch.factory';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import type { SessionCommandResult } from '../../domain/session-command.types';
import { SESSION_EVENT_KINDS, startCanBeRetried } from '../../domain/session-state.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { SESSION_DISPATCH, WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { RetrySessionCommand } from './retry-session.command';

/**
 * Tries a failed start again: the console's Try again under "The session did
 * not start". The host is sent the same create, for the same session id, with
 * the first task the log kept, so a person who fixed the cause on the host (a
 * sign-in, a missing tool) does not retype the task or lose the session's name.
 *
 * It records a **request**: `session.retry_requested` moves the session back to
 * `starting`, and what the host reports next is the new attempt. The runner keeps
 * nothing of a start that failed, so it builds the session from the beginning;
 * a host that is offline gets the create again on its next hello, as any
 * session still starting does.
 *
 * The append holds only while the session is still `failed`, so two presses
 * send one create.
 */
@CommandHandler(RetrySessionCommand)
export class RetrySessionCommandHandler
  implements ICommandHandler<RetrySessionCommand, SessionCommandResult>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(PROJECT_LOOKUP)
    private readonly projects: ProjectLookupPort,
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
    private readonly launches: SessionLaunchSpecFactory,
  ) {}

  async execute(command: RetrySessionCommand): Promise<SessionCommandResult> {
    const session = await this.loader.requireLiveOnHost(command.scope, command.sessionId);
    // `startCanBeRetried` is the rule, asked again under the row's lock below;
    // this read of it only turns a refusal into SESSIONS_052 rather than a no-op.
    if (!startCanBeRetried(session.fold, session.place)) {
      throw new AppError(SessionErrors.NOT_FAILED, {
        detail: session.cloudSessionId
          ? `Session ${session.slug} started at its vendor as ${session.cloudSessionId}; its task failed there`
          : `Session ${session.slug} is ${session.state}`,
      });
    }

    await requireActiveProject(this.projects, command.scope, session.projectId);
    await this.hosts.assertUsable(command.scope, session.hostId);

    const appended = await this.sessions.appendEventsIf(
      session,
      [
        {
          idempotencyKey: WorkSessionEntity.apiIdempotencyKey(
            command.id,
            SESSION_EVENT_KINDS.RETRY_REQUESTED,
          ),
          source: 'api',
          kind: SESSION_EVENT_KINDS.RETRY_REQUESTED,
          payload: { requestedBy: 'api' },
        },
      ],
      (fold) => startCanBeRetried(fold, session.place),
    );
    // Another press got there first and sent the create: this one has nothing to add.
    if (!appended) return { sessionId: session.id, hints: [] };

    const first = await this.sessions.findFirstPrompt(session);
    const { hints } = await this.dispatch.create(
      session,
      await this.launches.build(session, first),
    );
    return { sessionId: session.id, hints };
  }
}
