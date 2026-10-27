import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../../hosts/hosts.di-tokens';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { SessionPort, SessionPortsPort } from '../../application/session-ports.port';
import { SessionErrors } from '../../domain/sessions.errors';
import { SESSION_PORTS } from '../../sessions.di-tokens';
import { FindSessionPortsQuery } from './find-session-ports.query';

export interface SessionPortsRead {
  state: 'listed' | 'host_offline' | 'not_supported';
  ports: SessionPort[];
}

/**
 * The Browser tab's read (`product/versions/mvp/30-session-previews.md`): the
 * ports the session listens on, asked of its runner live, so a dev server
 * that just started appears on the tab's next poll. A host with no link, or a
 * runner that cannot list, is an answer the tab draws rather than a failure;
 * a runner that does not answer in time is `SESSIONS_031`.
 */
@QueryHandler(FindSessionPortsQuery)
export class FindSessionPortsQueryHandler
  implements IQueryHandler<FindSessionPortsQuery, SessionPortsRead>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
    @Inject(SESSION_PORTS)
    private readonly ports: SessionPortsPort,
  ) {}

  async execute(query: FindSessionPortsQuery): Promise<SessionPortsRead> {
    const session = await this.loader.requireLive(query.scope, query.sessionId);
    await this.hosts.assertUsable(query.scope, session.hostId);
    const outcome = await this.ports.list(session.hostId, session.id);
    switch (outcome.kind) {
      case 'listed':
        return { state: 'listed', ports: outcome.ports };
      case 'host_offline':
      case 'not_supported':
        return { state: outcome.kind, ports: [] };
      case 'failed':
        // `PORT_003`: the runner cannot read sockets on its platform.
        return { state: 'not_supported', ports: [] };
      case 'timed_out':
        throw new AppError(SessionErrors.FOLDERS_TIMED_OUT, {
          detail: 'The host did not list the session’s ports in time',
        });
    }
  }
}
