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
  /** The worker's read: the key a turn of a bot in `organizationId` runs on. */
  findForRun(
    organizationId: string,
    provider: BotProvider,
  ): Promise<Option<ModelProviderCredentialEntity>>;
  /** Stores it, replacing the workspace's key for that provider when there is one. */
  put(credential: ModelProviderCredentialEntity): Promise<void>;
  /** Whether there was a key to remove. */
  delete(scope: AccessScope, provider: BotProvider): Promise<boolean>;
  /**
   * The worker's refresh of a sign-in (ChatGPT): replaces the sealed secret,
   * only while the row still holds the one `credential` was read with. False
   * when another writer (a second refresh, a new sign-in) moved it first.
   */
  rotateSecret(
    credential: ModelProviderCredentialEntity,
    sealedKey: Buffer,
    keyHint: string,
  ): Promise<boolean>;
  /** The worker's removal of a sign-in the provider refused, only while it is still the one read. */
  deleteIfUnchanged(credential: ModelProviderCredentialEntity): Promise<boolean>;
}
