import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ModelProviderResolver } from '../../application/model-provider.resolver';
import { MODEL_PROVIDER_CREDENTIAL_REPOSITORY } from '../../bots.di-tokens';
import type { ModelProviderCredentialRepositoryPort } from '../../database/model-provider-credential.repository.port';
import { DeleteModelProviderCredentialCommand } from './delete-model-provider-credential.command';

/** Forget the workspace's key for a provider. Removing one that is not there is not an error. */
@CommandHandler(DeleteModelProviderCredentialCommand)
export class DeleteModelProviderCredentialCommandHandler
  implements ICommandHandler<DeleteModelProviderCredentialCommand, void>
{
  constructor(
    private readonly providers: ModelProviderResolver,
    @Inject(MODEL_PROVIDER_CREDENTIAL_REPOSITORY)
    private readonly credentials: ModelProviderCredentialRepositoryPort,
  ) {}

  async execute({ scope, provider }: DeleteModelProviderCredentialCommand): Promise<void> {
    await this.credentials.delete(scope, this.providers.provider(provider));
  }
}
