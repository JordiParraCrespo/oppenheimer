import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { FlagSegmentRepositoryPort } from '../../database/flag-segment.repository.port';
import { segmentProblems } from '../../domain/feature-flag.policy';
import { FeatureFlagErrors } from '../../domain/feature-flags.errors';
import { FlagSegmentEntity } from '../../domain/flag-segment.entity';
import { FLAG_SEGMENT_REPOSITORY } from '../../feature-flags.di-tokens';
import { CreateFlagSegmentCommand } from './create-flag-segment.command';

@CommandHandler(CreateFlagSegmentCommand)
export class CreateFlagSegmentCommandHandler
  implements ICommandHandler<CreateFlagSegmentCommand, AggregateID>
{
  constructor(
    @Inject(FLAG_SEGMENT_REPOSITORY)
    private readonly segments: FlagSegmentRepositoryPort,
  ) {}

  async execute(command: CreateFlagSegmentCommand): Promise<AggregateID> {
    const problems = segmentProblems(command.conditions);
    if (problems.length > 0) {
      throw new AppError(FeatureFlagErrors.INVALID_SEGMENT, {
        detail: problems.join('; '),
        extensions: { segment: command.key, problems },
      });
    }

    if ((await this.segments.findOneByKey(command.key)).isSome()) {
      throw new AppError(FeatureFlagErrors.SEGMENT_KEY_TAKEN, {
        detail: `A segment "${command.key}" already exists.`,
        extensions: { segment: command.key },
      });
    }

    const segment = FlagSegmentEntity.createNew(
      {
        key: command.key,
        name: command.name,
        description: command.description,
        conditions: command.conditions,
      },
      { actorId: command.actorId, comment: command.comment },
    );
    await this.segments.insert(segment);
    return segment.id;
  }
}
