import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type {
  FeatureFlagRepositoryPort,
  FlagTransaction,
} from '../../database/feature-flag.repository.port';
import type { FlagSegmentRepositoryPort } from '../../database/flag-segment.repository.port';
import { FeatureFlagErrors } from '../../domain/feature-flags.errors';
import { FEATURE_FLAG_REPOSITORY, FLAG_SEGMENT_REPOSITORY } from '../../feature-flags.di-tokens';
import { DeleteFlagSegmentCommand } from './delete-flag-segment.command';

/**
 * Refuses while any flag still targets the segment: a rule pointing at a
 * segment that no longer exists matches nobody, so deleting it would silently
 * shrink that rule's audience to zero. Remove it from the rules first. The
 * check and the delete run under the flag write lock, so no rule can start
 * targeting the segment in between.
 */
@CommandHandler(DeleteFlagSegmentCommand)
export class DeleteFlagSegmentCommandHandler
  implements ICommandHandler<DeleteFlagSegmentCommand, AggregateID>
{
  constructor(
    @Inject(FLAG_SEGMENT_REPOSITORY)
    private readonly segments: FlagSegmentRepositoryPort,
    @Inject(FEATURE_FLAG_REPOSITORY)
    private readonly flags: FeatureFlagRepositoryPort,
  ) {}

  execute(command: DeleteFlagSegmentCommand): Promise<AggregateID> {
    return this.flags.serialized((manager) => this.delete(command, manager));
  }

  private async delete(
    command: DeleteFlagSegmentCommand,
    manager: FlagTransaction,
  ): Promise<AggregateID> {
    const found = await this.segments.findOneByKey(command.key, manager);
    if (found.isNone()) {
      throw new AppError(FeatureFlagErrors.SEGMENT_NOT_FOUND, {
        detail: `No segment "${command.key}".`,
        extensions: { segment: command.key },
      });
    }

    const usedBy = (await this.flags.findAll(manager))
      .filter((flag) => flag.referencedSegments().includes(command.key))
      .map((flag) => flag.key);
    if (usedBy.length > 0) {
      throw new AppError(FeatureFlagErrors.SEGMENT_IN_USE, {
        detail: `Still targeted by: ${usedBy.join(', ')}.`,
        extensions: { segment: command.key, usedBy },
      });
    }

    const segment = found.unwrap();
    segment.delete({ actorId: command.actorId, comment: command.comment });
    await this.segments.delete(segment, manager);
    return segment.id;
  }
}
