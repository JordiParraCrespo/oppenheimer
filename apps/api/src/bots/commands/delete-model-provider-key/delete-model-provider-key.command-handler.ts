import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ModelProviderResolver } from '../../application/model-provider.resolver';
import { MODEL_PROVIDER_CREDENTIAL_REPOSITORY } from '../../bots.di-tokens';
import type { ModelProviderCredentialRepositoryPort } from '../../database/model-provider-credential.repository.port';
import { DeleteModelProviderKeyCommand } from './delete-model-provider-key.command';

/**
 * Forget one of a provider's keys; the others stay, and the next takes the
 * default mark if this one held it. Removing one that is not there is not an
 * error, as for the provider's whole set.
 */
@CommandHandler(DeleteModelProviderKeyCommand)
export class DeleteModelProviderKeyCommandHandler
  implements ICommandHandler<DeleteModelProviderKeyCommand, void>
{
  constructor(
    private readonly providers: ModelProviderResolver,
    @Inject(MODEL_PROVIDER_CREDENTIAL_REPOSITORY)
    private readonly credentials: ModelProviderCredentialRepositoryPort,
  ) {}

  async execute({ scope, provider, keyId }: DeleteModelProviderKeyCommand): Promise<void> {
    await this.credentials.deleteKey(scope, this.providers.provider(provider), keyId);
  }
}
