import type { AccessScope } from '@oppenheimer/backend-authz';
import type { BotProvider } from '@oppenheimer/shared';
import type { Option } from 'oxide.ts';
import type { ModelProviderCredentialEntity } from '../domain/model-provider-credential.entity';

export interface ModelProviderCredentialRepositoryPort {
  /** The workspace's stored keys, one per provider at most. */
  findAll(scope: AccessScope): Promise<ModelProviderCredentialEntity[]>;
  findOne(
    scope: AccessScope,
    provider: BotProvider,
  ): Promise<Option<ModelProviderCredentialEntity>>;
  /** Stores it, replacing the workspace's key for that provider when there is one. */
  put(credential: ModelProviderCredentialEntity): Promise<void>;
  /** Whether there was a key to remove. */
  delete(scope: AccessScope, provider: BotProvider): Promise<boolean>;
}
