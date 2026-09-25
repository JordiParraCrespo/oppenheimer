import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { HostPairingTokenEntity } from '../domain/host-pairing-token.entity';

export interface MintFence {
  /** How many spendable tokens one person may hold. */
  cap: number;
  now: Date;
  /** The caller's own token this mint replaces, already revoked in memory. */
  replacing?: HostPairingTokenEntity;
}

/**
 * Port for the pairing-token aggregate.
 *
 * Scoped by `HostResource`, exactly as hosts are: a token belongs to the person
 * who minted it, under the same `ownerUserId` column, and pairing is a Host
 * verb rather than a noun of its own.
 */
export interface HostPairingTokenRepositoryPort {
  save(entity: HostPairingTokenEntity): Promise<HostPairingTokenEntity>;
  /** Tokens the caller minted, newest first. */
  findAll(scope: AccessScope): Promise<HostPairingTokenEntity[]>;
  /** `None` both for a missing token and for someone else's. */
  findOneById(scope: AccessScope, id: string): Promise<Option<HostPairingTokenEntity>>;
  /**
   * The token a presented secret digests to, with no access scope: the caller is
   * a machine holding the secret, which is the credential — there is no person
   * on the request to scope by. Used only to tell a retried registration from a
   * refused one; the authority on whether a token may be spent is the burn.
   */
  findOneByHash(tokenHash: string): Promise<Option<HostPairingTokenEntity>>;
  /**
   * Mint `entity` unless its owner already holds `cap` spendable tokens — not
   * redeemed, not revoked, not expired at `now` — revoking `replacing` first in
   * the same transaction. The owner's mints are serialised, so two at once cannot
   * both find room. `false` means the cap held and nothing was written, the
   * revoke included.
   */
  insertWithinCap(entity: HostPairingTokenEntity, fence: MintFence): Promise<boolean>;
}
