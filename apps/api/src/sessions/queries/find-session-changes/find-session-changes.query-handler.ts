import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { SessionChangesResponse } from '@oppenheimer/shared';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import type { SessionChangesPort } from '../../application/session-changes.port';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import { SessionErrors } from '../../domain/sessions.errors';
import { SessionChangesMapper } from '../../session-changes.mapper';
import { SESSION_CHANGES } from '../../sessions.di-tokens';
import { FindSessionChangesQuery } from './find-session-changes.query';

/**
 * The Review's read: what the session's checkouts changed, asked of its
 * runner now, never on a timer (`product/design/console/33-session-tabs.md`
 * §5). Like the Terminal tab's windows, a host with no link, or a runner that
 * cannot read changes, is an answer the Review draws rather than a failure; a
 * runner that does not answer in time is `SESSIONS_031`.
 *
 * Owner only, through the workspace scope: a share guest reaches a session
 * through its share link, which attaches its terminal and nothing else.
 */
@QueryHandler(FindSessionChangesQuery)
export class FindSessionChangesQueryHandler
  implements IQueryHandler<FindSessionChangesQuery, SessionChangesResponse>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
    @Inject(SESSION_CHANGES)
    private readonly changes: SessionChangesPort,
  ) {}

  async execute(query: FindSessionChangesQuery): Promise<SessionChangesResponse> {
    const session = await this.loader.requireLiveOnHost(query.scope, query.sessionId);
    await this.hosts.assertUsable(query.scope, session.hostId);
    const outcome = await this.changes.read(session.hostId, session.id, query.compare);
    switch (outcome.kind) {
      case 'listed':
        return {
          state: 'listed',
          scope: query.compare,
          checkouts: outcome.checkouts.map(SessionChangesMapper.toResponse),
        };
      case 'host_offline':
      case 'not_supported':
        return { state: outcome.kind, scope: query.compare, checkouts: [] };
      case 'failed':
        // The session is not on the host (`SESS_001`), or git failed on it.
        return { state: 'not_supported', scope: query.compare, checkouts: [] };
      case 'timed_out':
        throw new AppError(SessionErrors.FOLDERS_TIMED_OUT, {
          detail: 'The host did not read the session’s changes in time',
        });
    }
  }
}
