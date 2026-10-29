import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { type HostRead, HostReadResolver } from '../../application/host-read.resolver';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import { HOST_REPOSITORY } from '../../hosts.di-tokens';
import { FindHostsQuery } from './find-hosts.query';

@QueryHandler(FindHostsQuery)
export class FindHostsQueryHandler implements IQueryHandler<FindHostsQuery, HostRead[]> {
  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
    private readonly reads: HostReadResolver,
  ) {}

  async execute(query: FindHostsQuery): Promise<HostRead[]> {
    const presences = await this.hosts.findAllWithPresence(query.scope, {
      includeUnpaired: query.includeUnpaired,
    });
    return this.reads.read(presences);
  }
}
