import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { type HostRead, HostReadResolver } from '../../application/host-read.resolver';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import { HostErrors } from '../../domain/hosts.errors';
import { HOST_REPOSITORY } from '../../hosts.di-tokens';
import { FindHostQuery } from './find-host.query';

@QueryHandler(FindHostQuery)
export class FindHostQueryHandler implements IQueryHandler<FindHostQuery, HostRead> {
  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
    private readonly reads: HostReadResolver,
  ) {}

  async execute(query: FindHostQuery): Promise<HostRead> {
    const found = await this.hosts.findOneByIdWithPresence(query.scope, query.hostId);

    // "The list filters but the detail does not" is the classic scoping bug, and
    // it cannot happen here: both read through the same scoped query, so a host
    // outside the caller's scope is simply not found.
    if (found.isNone()) {
      throw new AppError(HostErrors.NOT_FOUND, { detail: `No host with id ${query.hostId}` });
    }

    const [overview] = await this.reads.read([found.unwrap()]);
    return overview;
  }
}
