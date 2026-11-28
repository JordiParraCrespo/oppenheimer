import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireTenant } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { MODEL_PROVIDER_CATALOG, MODEL_PROVIDER_KEYS_MAX } from '@oppenheimer/shared';
import { ModelProviderResolver } from '../../application/model-provider.resolver';
import { MODEL_PROVIDER_CREDENTIAL_REPOSITORY, PROVIDER_KEY_SEALER } from '../../bots.di-tokens';
import type { ModelProviderCredentialRepositoryPort } from '../../database/model-provider-credential.repository.port';
import { BotErrors } from '../../domain/bots.errors';
import {
  keyHintOf,
  ModelProviderCredentialEntity,
} from '../../domain/model-provider-credential.entity';
import type { ProviderKeySealerPort } from '../../infrastructure/provider-key-sealer.port';
import { AddModelProviderKeyCommand } from './add-model-provider-key.command';

/**
 * Settings → Model providers: another key for a provider, after the ones
 * there. A call tries the provider's keys in order and moves to the next when
 * one runs out of credit. Sealed before it is stored, never checked against
 * the provider here. A sign-in (ChatGPT) takes no key (`BOTS_017`); a
 * provider holding `MODEL_PROVIDER_KEYS_MAX` takes no more (`BOTS_049`).
 */
@CommandHandler(AddModelProviderKeyCommand)
export class AddModelProviderKeyCommandHandler
  implements ICommandHandler<AddModelProviderKeyCommand, AggregateID>
{
  constructor(
    private readonly providers: ModelProviderResolver,
    @Inject(PROVIDER_KEY_SEALER)
    private readonly sealer: ProviderKeySealerPort,
    @Inject(MODEL_PROVIDER_CREDENTIAL_REPOSITORY)
    private readonly credentials: ModelProviderCredentialRepositoryPort,
  ) {}

  async execute({ scope, provider, apiKey }: AddModelProviderKeyCommand): Promise<AggregateID> {
    const known = this.providers.provider(provider);
    if (MODEL_PROVIDER_CATALOG[known].auth !== 'api_key') {
      throw new AppError(BotErrors.CHATGPT_SIGN_IN_ONLY);
    }
    requireTenant(scope);
    this.providers.assertConfigured();
    const credential = ModelProviderCredentialEntity.createNew({
      organizationId: scope.organizationId,
      provider: known,
      sealedKey: this.sealer.seal(apiKey),
      keyHint: keyHintOf(apiKey),
      updatedByUserId: scope.userId,
    });
    if ((await this.credentials.add(credential)) === 'full') {
      throw new AppError(BotErrors.PROVIDER_KEYS_FULL, {
        detail: `A provider holds ${MODEL_PROVIDER_KEYS_MAX} keys at most`,
      });
    }
    return credential.id;
  }
}
