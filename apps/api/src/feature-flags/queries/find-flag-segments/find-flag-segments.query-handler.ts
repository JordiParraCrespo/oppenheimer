import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { FeatureFlagRepositoryPort } from '../../database/feature-flag.repository.port';
import type { FlagSegmentRepositoryPort } from '../../database/flag-segment.repository.port';
import { FEATURE_FLAG_REPOSITORY, FLAG_SEGMENT_REPOSITORY } from '../../feature-flags.di-tokens';
import { FindFlagSegmentsQuery, type FlagSegmentView } from './find-flag-segments.query';

@QueryHandler(FindFlagSegmentsQuery)
export class FindFlagSegmentsQueryHandler
  implements IQueryHandler<FindFlagSegmentsQuery, FlagSegmentView[]>
{
  constructor(
    @Inject(FLAG_SEGMENT_REPOSITORY)
    private readonly segments: FlagSegmentRepositoryPort,
    @Inject(FEATURE_FLAG_REPOSITORY)
    private readonly flags: FeatureFlagRepositoryPort,
  ) {}

  async execute(query: FindFlagSegmentsQuery): Promise<FlagSegmentView[]> {
    const [all, flags] = await Promise.all([this.segments.findAll(), this.flags.findAll()]);
    const segments = query.key ? all.filter((segment) => segment.key === query.key) : all;
    return segments.map((entity) => ({
      entity,
      usedBy: flags
        .filter((flag) => flag.referencedSegments().includes(entity.key))
        .map((flag) => flag.key),
    }));
  }
}
