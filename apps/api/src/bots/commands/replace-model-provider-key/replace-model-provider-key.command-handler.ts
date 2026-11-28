import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireTenant } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { MODEL_PROVIDER_CATALOG } from '@oppenheimer/shared';
import { ModelProviderResolver } from '../../application/model-provider.resolver';
import { MODEL_PROVIDER_CREDENTIAL_REPOSITORY, PROVIDER_KEY_SEALER } from '../../bots.di-tokens';
import type { ModelProviderCredentialRepositoryPort } from '../../database/model-provider-credential.repository.port';
import { BotErrors } from '../../domain/bots.errors';
import { keyHintOf } from '../../domain/model-provider-credential.entity';
import type { ProviderKeySealerPort } from '../../infrastructure/provider-key-sealer.port';
import { ReplaceModelProviderKeyCommand } from './replace-model-provider-key.command';

/**
 * Settings → Model providers: one of a provider's keys replaced in its place,
 * its spent mark gone with the old key. `BOTS_050` when the workspace has no
 * such key for that provider.
 */
@CommandHandler(ReplaceModelProviderKeyCommand)
export class ReplaceModelProviderKeyCommandHandler
  implements ICommandHandler<ReplaceModelProviderKeyCommand, AggregateID>
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
    keyId,
    apiKey,
  }: ReplaceModelProviderKeyCommand): Promise<AggregateID> {
    const known = this.providers.provider(provider);
    if (MODEL_PROVIDER_CATALOG[known].auth !== 'api_key') {
      throw new AppError(BotErrors.CHATGPT_SIGN_IN_ONLY);
    }
    requireTenant(scope);
    this.providers.assertConfigured();
    const replaced = await this.credentials.replaceKey(
      scope,
      known,
      keyId,
      this.sealer.seal(apiKey),
      keyHintOf(apiKey),
    );
    if (!replaced) throw new AppError(BotErrors.PROVIDER_KEY_NOT_FOUND);
    return keyId;
  }
}
