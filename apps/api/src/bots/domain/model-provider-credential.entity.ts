import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { BOT_PROVIDERS, type BotProvider } from '@oppenheimer/shared';

export interface ModelProviderCredentialProps {
  organizationId: string;
  provider: BotProvider;
  /** The key, sealed by `ProviderKeySealerPort`; never the key itself. */
  sealedKey: Buffer;
  /** The key's last four characters, so a person can tell which one is stored. */
  keyHint: string;
  /** Who stored it last; null once that account is gone. */
  updatedByUserId: string | null;
}

/** How many of a key's last characters the console may show. */
export const KEY_HINT_LENGTH = 4;

/** The visible end of `key`: its last four characters, or less of a shorter one. */
export function keyHintOf(key: string): string {
  return key.slice(-KEY_HINT_LENGTH);
}

/**
 * A workspace's key for one model provider (`product/versions/mvp/25-bots.md`
 * §2): one per workspace and provider, replaced whole, read only by the worker
 * that runs a bot's turn.
 */
export class ModelProviderCredentialEntity extends AggregateRoot<ModelProviderCredentialProps> {
  static create(
    create: CreateEntityProps<ModelProviderCredentialProps>,
  ): ModelProviderCredentialEntity {
    return new ModelProviderCredentialEntity(create);
  }

  static createNew(props: {
    organizationId: string;
    provider: BotProvider;
    sealedKey: Buffer;
    keyHint: string;
    updatedByUserId: string;
  }): ModelProviderCredentialEntity {
    const credential = new ModelProviderCredentialEntity({ id: randomUUID(), props: { ...props } });
    credential.validate();
    return credential;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }

  get provider(): BotProvider {
    return this.props.provider;
  }

  get sealedKey(): Buffer {
    return this.props.sealedKey;
  }

  get keyHint(): string {
    return this.props.keyHint;
  }

  get updatedByUserId(): string | null {
    return this.props.updatedByUserId;
  }

  public validate(): void {
    const { props } = this;
    if (!props.organizationId) {
      throw new ArgumentNotProvidedException('A provider key belongs to a workspace');
    }
    if (!BOT_PROVIDERS.includes(props.provider)) {
      throw new ArgumentInvalidException(`${props.provider} is not a bot provider`);
    }
    if (props.sealedKey.length === 0) {
      throw new ArgumentNotProvidedException('A provider key is stored sealed');
    }
    if (props.keyHint.length > KEY_HINT_LENGTH) {
      throw new ArgumentInvalidException(`A key's hint is at most ${KEY_HINT_LENGTH} characters`);
    }
  }
}
