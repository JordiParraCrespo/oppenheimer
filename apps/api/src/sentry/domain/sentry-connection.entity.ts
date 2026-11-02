import { randomUUID } from 'node:crypto';
import { AggregateRoot, type CreateEntityProps } from '@oppenheimer/backend-ddd';

export interface SentryConnectionProps {
  organizationId: string;
  /** The Sentry organization's slug, as in `https://<slug>.sentry.io`. */
  organizationSlug: string;
  /** The internal integration's client secret, sealed under `SENTRY_CONNECTION_KEY`. */
  sealedClientSecret: Buffer;
  /** The secret's last four characters, so the owner can tell which one is stored. */
  secretHint: string;
  createdByUserId: string;
}

/** The four characters a stored secret is told apart by. */
export function secretHintOf(secret: string): string {
  return secret.slice(-4);
}

/**
 * The workspace's Sentry organization (`product/next-steps/sentry.md`): one per
 * workspace; a second replaces the first. Its id is in the webhook URL, which
 * names the workspace before the signature is checked with its secret.
 */
export class SentryConnectionEntity extends AggregateRoot<SentryConnectionProps> {
  static create(create: CreateEntityProps<SentryConnectionProps>): SentryConnectionEntity {
    return new SentryConnectionEntity(create);
  }

  static connect(props: SentryConnectionProps): SentryConnectionEntity {
    return new SentryConnectionEntity({ id: randomUUID(), props });
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get organizationSlug(): string {
    return this.props.organizationSlug;
  }
  get sealedClientSecret(): Buffer {
    return this.props.sealedClientSecret;
  }
  get secretHint(): string {
    return this.props.secretHint;
  }
  get createdByUserId(): string {
    return this.props.createdByUserId;
  }

  public validate(): void {}
}
