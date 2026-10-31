import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { requireTenant } from '../../../authz/application/tenant-scope.policy';
import { ModelProviderResolver } from '../../application/model-provider.resolver';
import { MODEL_PROVIDER_CREDENTIAL_REPOSITORY } from '../../bots.di-tokens';
import type { ModelProviderCredentialRepositoryPort } from '../../database/model-provider-credential.repository.port';
import { BotErrors } from '../../domain/bots.errors';
import { SetDefaultModelProviderCommand } from './set-default-model-provider.command';

/**
 * Settings → Model providers: the provider new bots start on. Only one the
 * workspace has a key for, so a new bot never starts on a provider it cannot
 * answer with; bots already made keep theirs.
 */
@CommandHandler(SetDefaultModelProviderCommand)
export class SetDefaultModelProviderCommandHandler
  implements ICommandHandler<SetDefaultModelProviderCommand, void>
{
  constructor(
    private readonly providers: ModelProviderResolver,
    @Inject(MODEL_PROVIDER_CREDENTIAL_REPOSITORY)
    private readonly credentials: ModelProviderCredentialRepositoryPort,
  ) {}

  async execute({ scope, provider }: SetDefaultModelProviderCommand): Promise<void> {
    const known = this.providers.provider(provider);
    requireTenant(scope);
    if (!(await this.credentials.setDefault(scope, known))) {
      throw new AppError(BotErrors.DEFAULT_PROVIDER_KEY_MISSING, {
        detail: `Store a key for ${known} first`,
      });
    }
  }
}
