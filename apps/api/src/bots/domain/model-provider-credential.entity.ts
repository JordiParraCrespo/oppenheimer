import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { MODEL_PROVIDERS, type ModelProvider } from '@oppenheimer/shared';

export interface ModelProviderCredentialProps {
  organizationId: string;
  provider: ModelProvider;
  /** The key, sealed by `ProviderKeySealerPort`; never the key itself. */
  sealedKey: Buffer;
  /** The key's last four characters, so a person can tell which one is stored. */
  keyHint: string;
  /** Who stored it last; null once that account is gone. */
  updatedByUserId: string | null;
  /**
   * The workspace marked this key's provider as the one new bots start on. Not
   * the resolved default: with none marked, `defaultBotProvider` falls back.
   */
  markedDefault: boolean;
  /** Where the key stands among its provider's: a turn tries the lowest first. */
  position: number;
  /** When a turn on it was refused for credit or quota; null while it is not known to be spent. */
  spentAt: Date | null;
}

/** How many of a key's last characters the console may show. */
export const KEY_HINT_LENGTH = 4;

/** The visible end of `key`: its last four characters, or less of a shorter one. */
export function keyHintOf(key: string): string {
  return key.slice(-KEY_HINT_LENGTH);
}

/**
 * One of a workspace's keys for a model provider. A provider may hold several,
 * in order (`position`): a turn runs on the first that is not spent
 * (`keysInTurnOrder`). A key is replaced whole, and read only by the worker
 * that runs a call on it. A sign-in (ChatGPT) is one row, and only one.
 */
export class ModelProviderCredentialEntity extends AggregateRoot<ModelProviderCredentialProps> {
  static create(
    create: CreateEntityProps<ModelProviderCredentialProps>,
  ): ModelProviderCredentialEntity {
    return new ModelProviderCredentialEntity(create);
  }

  static createNew(props: {
    organizationId: string;
    provider: ModelProvider;
    sealedKey: Buffer;
    keyHint: string;
    updatedByUserId: string;
    position?: number;
  }): ModelProviderCredentialEntity {
    const credential = new ModelProviderCredentialEntity({
      id: randomUUID(),
      props: { position: 0, ...props, markedDefault: false, spentAt: null },
    });
    credential.validate();
    return credential;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }

  get provider(): ModelProvider {
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

  get markedDefault(): boolean {
    return this.props.markedDefault;
  }

  get position(): number {
    return this.props.position;
  }

  get spentAt(): Date | null {
    return this.props.spentAt;
  }

  public validate(): void {
    const { props } = this;
    if (!props.organizationId) {
      throw new ArgumentNotProvidedException('A provider key belongs to a workspace');
    }
    if (!MODEL_PROVIDERS.includes(props.provider)) {
      throw new ArgumentInvalidException(`${props.provider} is not a model provider`);
    }
    if (props.sealedKey.length === 0) {
      throw new ArgumentNotProvidedException('A provider key is stored sealed');
    }
    if (props.keyHint.length > KEY_HINT_LENGTH) {
      throw new ArgumentInvalidException(`A key's hint is at most ${KEY_HINT_LENGTH} characters`);
    }
    if (!Number.isInteger(props.position) || props.position < 0) {
      throw new ArgumentInvalidException('A key stands at a whole position, from 0');
    }
  }
}
