import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { getFlagDefinition, isFeatureFlagKey } from '@oppenheimer/shared/feature-flags';
import type { FeatureFlagRepositoryPort } from '../../database/feature-flag.repository.port';
import { FeatureFlagEntity } from '../../domain/feature-flag.entity';
import { FeatureFlagErrors } from '../../domain/feature-flags.errors';
import { FEATURE_FLAG_REPOSITORY } from '../../feature-flags.di-tokens';
import { ToggleFeatureFlagCommand } from './toggle-feature-flag.command';

/**
 * Flips the master switch and nothing else, so pulling a kill switch in an
 * incident cannot also clobber targeting someone else was editing. Flipping it
 * to where it already is writes nothing and audits nothing.
 */
@CommandHandler(ToggleFeatureFlagCommand)
export class ToggleFeatureFlagCommandHandler
  implements ICommandHandler<ToggleFeatureFlagCommand, AggregateID>
{
  constructor(
    @Inject(FEATURE_FLAG_REPOSITORY)
    private readonly flags: FeatureFlagRepositoryPort,
  ) {}

  async execute(command: ToggleFeatureFlagCommand): Promise<AggregateID> {
    if (!isFeatureFlagKey(command.key)) {
      throw new AppError(FeatureFlagErrors.UNKNOWN_FLAG, {
        detail: `No flag "${command.key}" is declared in the catalog.`,
        extensions: { flag: command.key },
      });
    }

    const found = await this.flags.findOneByKey(command.key);
    const flag = found.isSome()
      ? found.unwrap()
      : FeatureFlagEntity.createFor(command.key, getFlagDefinition(command.key).defaultValue);

    const changed = flag.setEnabled(command.enabled, {
      actorId: command.actorId,
      comment: command.comment,
    });
    if (changed) await this.flags.save(flag);
    return flag.id;
  }
}
