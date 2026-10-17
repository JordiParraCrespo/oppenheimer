import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { MODEL_PROVIDER_CREDENTIAL_REPOSITORY } from '../../bots.di-tokens';
import type { ModelProviderCredentialRepositoryPort } from '../../database/model-provider-credential.repository.port';
import type { ModelProviderCredentialEntity } from '../../domain/model-provider-credential.entity';
import { FindModelProviderCredentialsQuery } from './find-model-provider-credentials.query';

/** The workspace's stored provider keys, sealed; the controller says which providers have none. */
@QueryHandler(FindModelProviderCredentialsQuery)
export class FindModelProviderCredentialsQueryHandler
  implements IQueryHandler<FindModelProviderCredentialsQuery, ModelProviderCredentialEntity[]>
{
  constructor(
    @Inject(MODEL_PROVIDER_CREDENTIAL_REPOSITORY)
    private readonly credentials: ModelProviderCredentialRepositoryPort,
  ) {}

  execute({ scope }: FindModelProviderCredentialsQuery): Promise<ModelProviderCredentialEntity[]> {
    return this.credentials.findAll(scope);
  }
}
