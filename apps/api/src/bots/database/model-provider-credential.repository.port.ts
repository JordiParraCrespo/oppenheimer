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
  /** The provider a new bot in the workspace starts on (`defaultBotProvider`). */
  defaultProvider(scope: AccessScope): Promise<BotProvider>;
  /**
   * Marks the workspace's key for `provider` as the one new bots start on, and
   * no other. False, with nothing changed, when there is no such key.
   */
  setDefault(scope: AccessScope, provider: BotProvider): Promise<boolean>;
  /** Whether there was a key to remove. */
  delete(scope: AccessScope, provider: BotProvider): Promise<boolean>;
  /**
   * Replaces the sealed secret only while the row still holds the one
   * `credential` was read with: an optimistic write, for a secret the server
   * changes on its own (a refreshed token). False when another writer moved
   * it first; the caller reads again rather than retrying its own value.
   */
  replaceSecretIfUnchanged(
    credential: ModelProviderCredentialEntity,
    sealedKey: Buffer,
    keyHint: string,
  ): Promise<boolean>;
  /** Removes the credential only while it is still the one read: false when it was replaced or removed first. */
  deleteIfUnchanged(credential: ModelProviderCredentialEntity): Promise<boolean>;
}
