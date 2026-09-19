import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { HostPresence, HostRepositoryPort } from '../../database/host.repository.port';
import { HOST_REPOSITORY } from '../../hosts.di-tokens';
import { FindHostsQuery } from './find-hosts.query';

@QueryHandler(FindHostsQuery)
export class FindHostsQueryHandler implements IQueryHandler<FindHostsQuery, HostPresence[]> {
  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
  ) {}

  async execute(query: FindHostsQuery): Promise<HostPresence[]> {
    return this.hosts.findAllWithPresence(query.scope);
  }
}
