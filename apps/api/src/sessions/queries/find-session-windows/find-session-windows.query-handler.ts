import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { SessionWindowsResponse } from '@oppenheimer/shared';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { SessionWindowsPort } from '../../application/session-windows.port';
import { toTerminalWindow } from '../../application/session-windows-refusal.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import { SESSION_WINDOWS } from '../../sessions.di-tokens';
import { FindSessionWindowsQuery } from './find-session-windows.query';

/**
 * The Terminal tab's read: the session's tmux windows, asked of its runner
 * live, so a shell its user ended with `exit` is gone on the next read. Like
 * the Browser tab's ports, a host with no link, or a runner that cannot list,
 * is an answer the tab draws rather than a failure (a refusal reads as the
 * latter); a runner that does not answer in time is `SESSIONS_031`.
 *
 * Owner only, through the workspace scope: a share guest reaches a session
 * through its share link, which attaches window 0 and nothing else.
 */
@QueryHandler(FindSessionWindowsQuery)
export class FindSessionWindowsQueryHandler
  implements IQueryHandler<FindSessionWindowsQuery, SessionWindowsResponse>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
    @Inject(SESSION_WINDOWS)
    private readonly windows: SessionWindowsPort,
  ) {}

  async execute(query: FindSessionWindowsQuery): Promise<SessionWindowsResponse> {
    const session = await this.loader.requireLiveOnHost(query.scope, query.sessionId);
    await this.hosts.assertUsable(query.scope, session.hostId);
    const outcome = await this.windows.list(session.hostId, session.id);
    switch (outcome.kind) {
      case 'listed':
        return { state: 'listed', windows: outcome.windows.map(toTerminalWindow) };
      case 'host_offline':
      case 'not_supported':
        return { state: outcome.kind, windows: [] };
      case 'failed':
        // The session is not running on the host (`SESS_003`), or tmux failed.
        return { state: 'not_supported', windows: [] };
      case 'timed_out':
        throw new AppError(SessionErrors.FOLDERS_TIMED_OUT, {
          detail: 'The host did not list the session’s terminals in time',
        });
    }
  }
}
