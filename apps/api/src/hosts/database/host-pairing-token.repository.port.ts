import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { HostPairingTokenEntity } from '../domain/host-pairing-token.entity';

/**
 * Port for the pairing-token aggregate.
 *
 * Scoped the same way hosts are, by the person: a token belongs to whoever
 * minted it, and `createdByUserId` is the only ownership column.
 */
export interface HostPairingTokenRepositoryPort {
  insert(entity: HostPairingTokenEntity): Promise<void>;
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
}
