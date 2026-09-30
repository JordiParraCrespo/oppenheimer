import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
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
import { SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { SESSION_DISPATCH, WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { RestartSessionCommand } from './restart-session.command';

/**
 * Restarts a session in the worktrees it already has: after a host reboot every
 * session shows stopped with Restart, which recreates window 0 in the same
 * directories rather than a second set. Slug, directory and branch never change,
 * which is why the launch spec is derived rather than stored.
 *
 * It records a **request**, not an outcome: the session becomes `open` when the host
 * says it did. Stopping differs because there the control plane's decision is the
 * fact. One append; what could not be delivered is a hint on the response.
 */
@CommandHandler(RestartSessionCommand)
export class RestartSessionCommandHandler
  implements ICommandHandler<RestartSessionCommand, SessionCommandResult>
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

  async execute(command: RestartSessionCommand): Promise<SessionCommandResult> {
    const session = await this.loader.requireLive(command.scope, command.sessionId);

    // Nothing restarts under a retired project, or on a host the caller can no
    // longer use (a grant revoked, the host unpaired).
    await requireActiveProject(this.projects, command.scope, session.projectId);
    await this.hosts.assertUsable(command.scope, session.hostId);

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
    const { hints } = await this.dispatch.restart(session, await this.launches.build(session));
    return { sessionId: session.id, hints };
  }
}
