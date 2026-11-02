import { randomUUID } from 'node:crypto';
import { AggregateRoot, type CreateEntityProps } from '@oppenheimer/backend-ddd';
import type { CloudAgentProviderId } from '@oppenheimer/shared';

export interface CloudAgentCredentialProps {
  organizationId: string;
  /** Whose key it is. Only they read it, and only their agents run on it. */
  userId: string;
  provider: CloudAgentProviderId;
  /** The key, sealed under `CLOUD_AGENTS_KEY`; never in the clear at rest. */
  sealedKey: Buffer;
  /** The key's last four characters, so the person can tell which one is stored. */
  keyHint: string;
  /** The name the person gave the key at the vendor. */
  keyName: string;
  /** The vendor account's address, when the key is a person's. */
  accountEmail: string | null;
  /**
   * The vendor's id for the account: what its rate limit counts against, so
   * the gateway's bucket. Null for a key that names no person (a team's).
   */
  accountId: string | null;
}

/** The four characters a stored key is told apart by. */
export function keyHintOf(apiKey: string): string {
  return apiKey.slice(-4);
}

/**
 * A person's own key for one cloud agent vendor (`product/next-steps/cloud-agents.md`):
 * what their cloud agents are launched and followed with. One per person,
 * workspace and vendor; a second replaces the first.
 */
export class CloudAgentCredentialEntity extends AggregateRoot<CloudAgentCredentialProps> {
  static create(create: CreateEntityProps<CloudAgentCredentialProps>): CloudAgentCredentialEntity {
    return new CloudAgentCredentialEntity(create);
  }

  static connect(props: CloudAgentCredentialProps): CloudAgentCredentialEntity {
    return new CloudAgentCredentialEntity({ id: randomUUID(), props });
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get userId(): string {
    return this.props.userId;
  }
  get provider(): CloudAgentProviderId {
    return this.props.provider;
  }
  get sealedKey(): Buffer {
    return this.props.sealedKey;
  }
  get keyHint(): string {
    return this.props.keyHint;
  }
  get keyName(): string {
    return this.props.keyName;
  }
  get accountEmail(): string | null {
    return this.props.accountEmail;
  }
  get accountId(): string | null {
    return this.props.accountId;
  }

  public validate(): void {}
}
