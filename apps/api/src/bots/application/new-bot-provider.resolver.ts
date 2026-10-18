import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import type { BotProvider } from '@oppenheimer/shared';
import { MODEL_PROVIDER_CREDENTIAL_REPOSITORY } from '../bots.di-tokens';
import type { ModelProviderCredentialRepositoryPort } from '../database/model-provider-credential.repository.port';
import { providerForNewBot } from '../domain/bot-creation.policy';

/**
 * The provider a new bot starts on: the one named, else one the workspace
 * has a key for (`providerForNewBot`). A model named without a provider
 * keeps Anthropic, the provider the default has always been for it.
 */
@Injectable()
export class NewBotProviderResolver {
  constructor(
    @Inject(MODEL_PROVIDER_CREDENTIAL_REPOSITORY)
    private readonly credentials: Pick<ModelProviderCredentialRepositoryPort, 'findAll'>,
  ) {}

  async providerFor(
    scope: AccessScope,
    named: BotProvider | undefined,
    model: string | null | undefined,
  ): Promise<BotProvider> {
    if (named) return named;
    if (model) return providerForNewBot([]);
    const keyed = await this.credentials.findAll(scope);
    return providerForNewBot(keyed.map((credential) => credential.provider));
  }
}
