import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { getFlagDefinition, isFeatureFlagKey } from '@oppenheimer/shared/feature-flags';
import type { FeatureFlagRepositoryPort } from '../../database/feature-flag.repository.port';
import type { FlagSegmentRepositoryPort } from '../../database/flag-segment.repository.port';
import { FeatureFlagEntity } from '../../domain/feature-flag.entity';
import { targetingProblems } from '../../domain/feature-flag.policy';
import { FeatureFlagErrors } from '../../domain/feature-flags.errors';
import { FEATURE_FLAG_REPOSITORY, FLAG_SEGMENT_REPOSITORY } from '../../feature-flags.di-tokens';
import { UpdateFeatureFlagCommand } from './update-feature-flag.command';

/**
 * Replaces a flag's targeting, creating its row on first save.
 *
 * The request schema has already checked shape; this checks meaning against
 * the catalog entry (a variant flag cannot serve a variant it does not
 * declare) and against the segments that exist, and refuses with every
 * problem listed rather than the first.
 */
@CommandHandler(UpdateFeatureFlagCommand)
export class UpdateFeatureFlagCommandHandler
  implements ICommandHandler<UpdateFeatureFlagCommand, AggregateID>
{
  constructor(
    @Inject(FEATURE_FLAG_REPOSITORY)
    private readonly flags: FeatureFlagRepositoryPort,
    @Inject(FLAG_SEGMENT_REPOSITORY)
    private readonly segments: FlagSegmentRepositoryPort,
  ) {}

  async execute(command: UpdateFeatureFlagCommand): Promise<AggregateID> {
    if (!isFeatureFlagKey(command.key)) {
      throw new AppError(FeatureFlagErrors.UNKNOWN_FLAG, {
        detail: `No flag "${command.key}" is declared in the catalog.`,
        extensions: { flag: command.key },
      });
    }
    const definition = getFlagDefinition(command.key);

    const targeting = {
      enabled: command.enabled,
      rules: command.rules,
      fallthrough: command.fallthrough,
    };
    const knownSegments = new Set((await this.segments.findAll()).map((segment) => segment.key));
    const problems = targetingProblems(definition, targeting, knownSegments);
    if (problems.length > 0) {
      throw new AppError(FeatureFlagErrors.INVALID_TARGETING, {
        detail: problems.join('; '),
        extensions: { flag: command.key, problems },
      });
    }

    const found = await this.flags.findOneByKey(command.key);
    const flag = found.isSome()
      ? found.unwrap()
      : FeatureFlagEntity.createFor(command.key, definition.defaultValue);

    flag.replaceTargeting(targeting, { actorId: command.actorId, comment: command.comment });
    await this.flags.save(flag);
    return flag.id;
  }
}
