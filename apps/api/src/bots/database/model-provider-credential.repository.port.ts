import type { AccessScope } from '@oppenheimer/backend-authz';
import type { BotProvider, ModelProvider } from '@oppenheimer/shared';
import type { Option } from 'oxide.ts';
import type { ModelProviderCredentialEntity } from '../domain/model-provider-credential.entity';

/** How adding a key went: stored, or refused because the provider holds `MODEL_PROVIDER_KEYS_MAX` already. */
export type AddModelProviderKeyOutcome = 'added' | 'full';

export interface ModelProviderCredentialRepositoryPort {
  /** The workspace's stored keys, every provider's, each provider's in its stored order. */
  findAll(scope: AccessScope): Promise<ModelProviderCredentialEntity[]>;
  /** Whether the workspace has one: the provider's first key in turn order (`keysInTurnOrder`). */
  findOne(
    scope: AccessScope,
    provider: ModelProvider,
  ): Promise<Option<ModelProviderCredentialEntity>>;
  /** The worker's read: the key a call in `organizationId` tries first (`keysInTurnOrder`). */
  findForRun(
    organizationId: string,
    provider: ModelProvider,
  ): Promise<Option<ModelProviderCredentialEntity>>;
  /** The worker's read: every key of the provider, in the order a call tries them. */
  findAllForRun(
    organizationId: string,
    provider: ModelProvider,
  ): Promise<ModelProviderCredentialEntity[]>;
  /**
   * Stores it as the provider's first key, replacing the one there (and its
   * spent mark) when there is one; the provider's other keys stay.
   */
  put(credential: ModelProviderCredentialEntity): Promise<void>;
  /** Stores it after the provider's last key; `full` with nothing stored at `MODEL_PROVIDER_KEYS_MAX`. */
  add(credential: ModelProviderCredentialEntity): Promise<AddModelProviderKeyOutcome>;
  /**
   * Replaces one key of the provider in its place, clearing its spent mark.
   * False when the workspace has no such key for that provider.
   */
  replaceKey(
    scope: AccessScope,
    provider: ModelProvider,
    keyId: string,
    sealedKey: Buffer,
    keyHint: string,
  ): Promise<boolean>;
  /**
   * Removes one key of the provider. When it carried the workspace's default
   * mark, the provider's next key takes it. False when there was no such key.
   */
  deleteKey(scope: AccessScope, provider: ModelProvider, keyId: string): Promise<boolean>;
  /**
   * Marks the key as out of credit at `at`, while it still holds the secret it
   * was read with (a key replaced since is a new key). False when it does not.
   */
  markSpent(credential: ModelProviderCredentialEntity, at: Date): Promise<boolean>;
  /** Clears the key's spent mark, while it still holds the secret it was read with and has one. */
  clearSpent(credential: ModelProviderCredentialEntity): Promise<void>;
  /** The provider a new bot in the workspace starts on (`defaultBotProvider`). */
  defaultProvider(scope: AccessScope): Promise<BotProvider>;
  /**
   * Marks the workspace's first key for `provider` as the one new bots start
   * on, and no other. False, with nothing changed, when there is no such key.
   */
  setDefault(scope: AccessScope, provider: BotProvider): Promise<boolean>;
  /** Removes every key of the provider; whether there was one. */
  delete(scope: AccessScope, provider: ModelProvider): Promise<boolean>;
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
