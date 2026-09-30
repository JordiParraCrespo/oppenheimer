import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentNotProvidedException,
  ArgumentOutOfRangeException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { type ResourceScope, type Scope, sortScopes, toResourceScope } from '@oppenheimer/shared';
import { generateApiTokenSecret } from './api-token-secret.factory';
import { ApiTokenRevokedDomainEvent } from './events/api-token-revoked.domain-event';
import { isIpAllowed } from './ip-allowlist.policy';

/**
 * The granularity of `lastUsedAt`. The column answers "is this token still in
 * use?", which a minute answers as well as a millisecond — and a token polled
 * ten times a second no longer costs ten row versions a second.
 */
export const LAST_USED_GRANULARITY_MS = 60_000;

export interface ApiTokenProps {
  /** Owner. The token's reach is re-derived from this user on every request. */
  userId: string;
  name: string;
  /** Non-secret display prefix. */
  prefix: string;
  /** SHA-256 digest of the secret. The secret itself is never stored. */
  tokenHash: string;
  scopes: Scope[];
  /** `null` — follow the owner's memberships; otherwise a fixed allowlist. */
  organizationIds: string[] | null;
  ipAllowlist: string[] | null;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface IssueApiTokenProps {
  userId: string;
  name: string;
  scopes: Scope[];
  organizationIds?: string[] | null;
  ipAllowlist?: string[] | null;
  /** `null`/omitted mints a token that does not expire. */
  expiresInDays?: number | null;
  /** Injected so the caller controls the clock (and tests stay deterministic). */
  now?: Date;
}

/** Why a credential was refused. `null` means it is usable. */
export type ApiTokenRejection = 'revoked' | 'expired' | 'ip-not-allowed';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_EXPIRY_DAYS = 3650;

/**
 * API token aggregate root.
 *
 * A token carries a set of {@link Scope}s and an optional organization
 * restriction. It never carries authority of its own: what it can actually do
 * is the intersection of its scopes with whatever its owner's roles still
 * permit at request time, so revoking a role instantly narrows every token
 * that user issued.
 */
export class ApiTokenEntity extends AggregateRoot<ApiTokenProps> {
  /** Rehydrate an existing token (used by the mapper). */
  static create(create: CreateEntityProps<ApiTokenProps>): ApiTokenEntity {
    return new ApiTokenEntity(create);
  }

  /**
   * Mint a new token. Returns the aggregate alongside the plaintext secret,
   * which is the only time it exists — the aggregate keeps just the digest.
   */
  static issue(props: IssueApiTokenProps): {
    token: ApiTokenEntity;
    secret: string;
  } {
    const now = props.now ?? new Date();
    const { secret, prefix, hash } = generateApiTokenSecret();

    if (props.expiresInDays != null) {
      if (!Number.isInteger(props.expiresInDays) || props.expiresInDays < 1) {
        throw new ArgumentOutOfRangeException('expiresInDays must be a positive whole number');
      }
      if (props.expiresInDays > MAX_EXPIRY_DAYS) {
        throw new ArgumentOutOfRangeException(`expiresInDays must not exceed ${MAX_EXPIRY_DAYS}`);
      }
    }

    const token = new ApiTokenEntity({
      id: randomUUID(),
      props: {
        userId: props.userId,
        name: props.name.trim(),
        prefix,
        tokenHash: hash,
        scopes: sortScopes(props.scopes),
        organizationIds: toResourceScope(props.organizationIds).organizationIds,
        ipAllowlist: props.ipAllowlist?.length ? [...props.ipAllowlist] : null,
        expiresAt:
          props.expiresInDays == null
            ? null
            : new Date(now.getTime() + props.expiresInDays * MILLISECONDS_PER_DAY),
        lastUsedAt: null,
        revokedAt: null,
      },
    });

    return { token, secret };
  }

  get userId(): string {
    return this.props.userId;
  }

  get name(): string {
    return this.props.name;
  }

  get prefix(): string {
    return this.props.prefix;
  }

  get tokenHash(): string {
    return this.props.tokenHash;
  }

  get scopes(): Scope[] {
    return this.props.scopes;
  }

  get organizationIds(): string[] | null {
    return this.props.organizationIds;
  }

  get ipAllowlist(): string[] | null {
    return this.props.ipAllowlist;
  }

  get expiresAt(): Date | null {
    return this.props.expiresAt;
  }

  get lastUsedAt(): Date | null {
    return this.props.lastUsedAt;
  }

  /** Whether a use at `now` is worth recording, at {@link LAST_USED_GRANULARITY_MS}. */
  isLastUseStale(now: Date): boolean {
    const last = this.props.lastUsedAt;
    return !last || now.getTime() - last.getTime() >= LAST_USED_GRANULARITY_MS;
  }

  get revokedAt(): Date | null {
    return this.props.revokedAt;
  }

  /** The organization restriction in the shape the shared helpers expect. */
  get resourceScope(): ResourceScope {
    return { organizationIds: this.props.organizationIds };
  }

  isRevoked(): boolean {
    return this.props.revokedAt !== null;
  }

  isExpired(now: Date = new Date()): boolean {
    return this.props.expiresAt !== null && this.props.expiresAt.getTime() <= now.getTime();
  }

  /**
   * Why this token may not be used right now, or `null` if it may. The source
   * address is required whenever the token carries an IP allowlist.
   */
  rejectionReason(
    options: { now?: Date; ipAddress?: string | null } = {},
  ): ApiTokenRejection | null {
    if (this.isRevoked()) return 'revoked';
    if (this.isExpired(options.now ?? new Date())) return 'expired';
    if (!isIpAllowed(this.props.ipAllowlist, options.ipAddress)) return 'ip-not-allowed';
    return null;
  }

  /** Revoke the token. Idempotent: revoking twice keeps the first timestamp. */
  revoke(now: Date = new Date()): void {
    if (this.isRevoked()) return;
    this.props.revokedAt = now;
    this.addEvent(
      new ApiTokenRevokedDomainEvent({
        aggregateId: this.id,
        userId: this.props.userId,
        tokenHash: this.props.tokenHash,
        reason:
          'Token was revoked; its cached delegated session must be dropped so the credential stops working immediately',
      }),
    );
  }

  validate(): void {
    if (!this.props.userId) {
      throw new ArgumentNotProvidedException('An API token must belong to a user');
    }
    if (!this.props.name) {
      throw new ArgumentNotProvidedException('An API token must have a name');
    }
    if (this.props.scopes.length === 0) {
      throw new ArgumentNotProvidedException('An API token must grant at least one scope');
    }
  }
}
