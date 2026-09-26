import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { type HostOverview, HostUsageRegistry } from '../../application/host-usage.registry';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import { HOST_REPOSITORY } from '../../hosts.di-tokens';
import { FindHostsQuery } from './find-hosts.query';

@QueryHandler(FindHostsQuery)
export class FindHostsQueryHandler implements IQueryHandler<FindHostsQuery, HostOverview[]> {
  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
    private readonly usage: HostUsageRegistry,
  ) {}

  async execute(query: FindHostsQuery): Promise<HostOverview[]> {
    const presences = await this.hosts.findAllWithPresence(query.scope, {
      includeUnpaired: query.includeUnpaired,
    });
    return this.usage.overview(presences);
  }
}
