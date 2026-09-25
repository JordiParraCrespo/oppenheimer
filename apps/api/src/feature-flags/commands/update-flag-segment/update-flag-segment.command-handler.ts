import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { FlagSegmentRepositoryPort } from '../../database/flag-segment.repository.port';
import { segmentProblems } from '../../domain/feature-flag.policy';
import { FeatureFlagErrors } from '../../domain/feature-flags.errors';
import { FLAG_SEGMENT_REPOSITORY } from '../../feature-flags.di-tokens';
import { UpdateFlagSegmentCommand } from './update-flag-segment.command';

/**
 * Edits a segment in place. Every flag targeting it follows the change on its
 * next evaluation — which is the point of a segment, and why the change is
 * audited like a flag change.
 */
@CommandHandler(UpdateFlagSegmentCommand)
export class UpdateFlagSegmentCommandHandler
  implements ICommandHandler<UpdateFlagSegmentCommand, AggregateID>
{
  constructor(
    @Inject(FLAG_SEGMENT_REPOSITORY)
    private readonly segments: FlagSegmentRepositoryPort,
  ) {}

  async execute(command: UpdateFlagSegmentCommand): Promise<AggregateID> {
    if (command.conditions) {
      const problems = segmentProblems(command.conditions);
      if (problems.length > 0) {
        throw new AppError(FeatureFlagErrors.INVALID_SEGMENT, {
          detail: problems.join('; '),
          extensions: { segment: command.key, problems },
        });
      }
    }

    const found = await this.segments.findOneByKey(command.key);
    if (found.isNone()) {
      throw new AppError(FeatureFlagErrors.SEGMENT_NOT_FOUND, {
        detail: `No segment "${command.key}".`,
        extensions: { segment: command.key },
      });
    }

    const segment = found.unwrap();
    segment.update(
      { name: command.name, description: command.description, conditions: command.conditions },
      { actorId: command.actorId, comment: command.comment },
    );
    await this.segments.save(segment);
    return segment.id;
  }
}
