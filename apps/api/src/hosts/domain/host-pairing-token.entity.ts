import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';

export interface HostPairingTokenProps {
  /** The person who minted it. The host it creates belongs to them. */
  createdByUserId: string;
  /**
   * The name the machine is given before it exists — the console names a box
   * ("Dev box") and the host adopts it at registration, so nobody has to rename
   * a machine that defaulted to its hostname.
   */
  intendedName: string;
  /** Non-secret display prefix, so a pasted secret can be recognised. */
  prefix: string;
  /** SHA-256 of the secret, hex. The secret itself is never stored. */
  tokenHash: string;
  /** Where it was minted from, and where it was spent (F5). */
  createdFromIp: string | null;
  redeemedFromIp: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  redeemedAt: Date | null;
  redeemedHostId: string | null;
}

export interface MintHostPairingTokenProps {
  createdByUserId: string;
  intendedName: string;
  prefix: string;
  tokenHash: string;
  createdFromIp?: string | null;
  expiresAt: Date;
}

/**
 * A registration token: host identity **before the host exists**.
 *
 * It is a row rather than a column for the reason `verification` is a table in
 * Better Auth's own schema — a token minted before its subject exists cannot
 * hang off that subject, and most rows never become a host. It is also the only
 * way F5's "revocable, expiring, with the source IP shown" can be true: all
 * three are things you can only act on if they persist.
 *
 * Nothing here decides whether the token may be spent. That is one atomic
 * statement in the repository, because a check followed by a write is a race two
 * machines can both win — see `HostRepositoryPort.redeemAndRegister`.
 */
export class HostPairingTokenEntity extends AggregateRoot<HostPairingTokenProps> {
  /** Rehydrate an existing token (used by the mapper). */
  static create(create: CreateEntityProps<HostPairingTokenProps>): HostPairingTokenEntity {
    return new HostPairingTokenEntity(create);
  }

  /** Mint a token. The caller holds the secret; only its digest lands here. */
  static mint(props: MintHostPairingTokenProps): HostPairingTokenEntity {
    return new HostPairingTokenEntity({
      id: randomUUID(),
      props: {
        createdByUserId: props.createdByUserId,
        intendedName: props.intendedName,
        prefix: props.prefix,
        tokenHash: props.tokenHash,
        createdFromIp: props.createdFromIp ?? null,
        redeemedFromIp: null,
        expiresAt: props.expiresAt,
        revokedAt: null,
        redeemedAt: null,
        redeemedHostId: null,
      },
    });
  }

  get createdByUserId(): string {
    return this.props.createdByUserId;
  }

  get intendedName(): string {
    return this.props.intendedName;
  }

  get prefix(): string {
    return this.props.prefix;
  }

  get tokenHash(): string {
    return this.props.tokenHash;
  }

  get createdFromIp(): string | null {
    return this.props.createdFromIp;
  }

  get redeemedFromIp(): string | null {
    return this.props.redeemedFromIp;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get revokedAt(): Date | null {
    return this.props.revokedAt;
  }

  get redeemedAt(): Date | null {
    return this.props.redeemedAt;
  }

  get redeemedHostId(): string | null {
    return this.props.redeemedHostId;
  }

  /**
   * Revoke the token and nothing else.
   *
   * The column is load-bearing: the redemption statement requires
   * `revokedAt IS NULL`, so without this write "revocable" would be a column
   * nobody reads and a revoked token would still pair a machine.
   */
  revoke(at: Date = new Date()): void {
    if (this.props.revokedAt) return;
    this.props.revokedAt = at;
    this.setUpdatedAt(at);
  }

  public validate(): void {
    if (!this.props.createdByUserId?.trim()) {
      throw new ArgumentNotProvidedException('A pairing token must have a creator');
    }
    if (!this.props.intendedName?.trim()) {
      throw new ArgumentNotProvidedException('A pairing token must name the machine it will pair');
    }
    if (!this.props.tokenHash?.trim()) {
      throw new ArgumentNotProvidedException('A pairing token must carry the digest of its secret');
    }
  }
}
