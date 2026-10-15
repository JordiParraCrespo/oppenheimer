import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { ModelProviderResolver } from '../../application/model-provider.resolver';
import { MODEL_PROVIDER_CREDENTIAL_REPOSITORY, PROVIDER_KEY_SEALER } from '../../bots.di-tokens';
import type { ModelProviderCredentialRepositoryPort } from '../../database/model-provider-credential.repository.port';
import { BotErrors } from '../../domain/bots.errors';
import {
  keyHintOf,
  ModelProviderCredentialEntity,
} from '../../domain/model-provider-credential.entity';
import type { ProviderKeySealerPort } from '../../infrastructure/provider-key-sealer.port';
import { PutModelProviderCredentialCommand } from './put-model-provider-credential.command';

/**
 * Settings → Model providers: the workspace's key for one provider, sealed
 * before it is stored, replacing the one there. The key is not checked against
 * the provider here; a bot's first turn on it says whether it works.
 */
@CommandHandler(PutModelProviderCredentialCommand)
export class PutModelProviderCredentialCommandHandler
  implements ICommandHandler<PutModelProviderCredentialCommand, AggregateID>
{
  constructor(
    private readonly providers: ModelProviderResolver,
    @Inject(PROVIDER_KEY_SEALER)
    private readonly sealer: ProviderKeySealerPort,
    @Inject(MODEL_PROVIDER_CREDENTIAL_REPOSITORY)
    private readonly credentials: ModelProviderCredentialRepositoryPort,
  ) {}

  async execute({
    scope,
    provider,
    apiKey,
  }: PutModelProviderCredentialCommand): Promise<AggregateID> {
    const known = this.providers.provider(provider);
    if (!scope.organizationId) throw new AppError(BotErrors.NO_ACTIVE_ORGANIZATION);
    this.providers.assertConfigured();
    const credential = ModelProviderCredentialEntity.createNew({
      organizationId: scope.organizationId,
      provider: known,
      sealedKey: this.sealer.seal(apiKey),
      keyHint: keyHintOf(apiKey),
      updatedByUserId: scope.userId,
    });
    await this.credentials.put(credential);
    return credential.id;
  }
}
