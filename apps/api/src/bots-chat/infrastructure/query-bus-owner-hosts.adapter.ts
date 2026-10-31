import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { AccessScope } from '../../authz/domain/access-scope.types';
import { FindHostsQuery } from '../../hosts/queries/find-hosts/find-hosts.query';
import type { OwnerHost, OwnerHostsPort } from './owner-hosts.port';

/** The part of `FindHostsQuery`'s answer a turn reads. */
interface HostOverview {
  host: { id: string; name: string };
  online: boolean;
  runningSessions: number;
}

/** The owner's hosts through the hosts module's own query, in their scope. */
@Injectable()
export class QueryBusOwnerHostsAdapter implements OwnerHostsPort {
  constructor(private readonly queryBus: QueryBus) {}

  async hostsOf(owner: AccessScope): Promise<OwnerHost[]> {
    const overviews = await this.queryBus.execute<FindHostsQuery, HostOverview[]>(
      new FindHostsQuery({ scope: owner }),
    );
    return overviews.map(({ host, online, runningSessions }) => ({
      id: host.id,
      name: host.name,
      online,
      runningSessions,
    }));
  }
}
