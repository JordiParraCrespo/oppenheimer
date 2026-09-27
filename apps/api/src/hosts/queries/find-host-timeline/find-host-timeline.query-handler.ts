import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { HostRepositoryPort } from '../../database/host.repository.port';
import type {
  HostMetadataRepositoryPort,
  TimelinePage,
} from '../../database/host-metadata.repository.port';
import { HostErrors } from '../../domain/hosts.errors';
import { HOST_METADATA_REPOSITORY, HOST_REPOSITORY } from '../../hosts.di-tokens';
import { FindHostTimelineQuery } from './find-host-timeline.query';

/**
 * A host's timeline. The host is read through the scoped repository first, so
 * the timeline of a host the caller cannot see is not found rather than empty,
 * and an unpaired host's history stays readable to its owner.
 */
@QueryHandler(FindHostTimelineQuery)
export class FindHostTimelineQueryHandler
  implements IQueryHandler<FindHostTimelineQuery, TimelinePage>
{
  constructor(
    @Inject(HOST_REPOSITORY)
    private readonly hosts: HostRepositoryPort,
    @Inject(HOST_METADATA_REPOSITORY)
    private readonly metadata: HostMetadataRepositoryPort,
  ) {}

  async execute(query: FindHostTimelineQuery): Promise<TimelinePage> {
    const found = await this.hosts.findOneById(query.scope, query.hostId);
    if (found.isNone()) {
      throw new AppError(HostErrors.NOT_FOUND, { detail: `No host with id ${query.hostId}` });
    }
    return this.metadata.findTimeline(query.hostId, query.before, query.limit);
  }
}
