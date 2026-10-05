import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { HostEntity } from '../domain/host.entity';
import type { HostNetwork, HostVitals, StoredHostInventory } from '../domain/host-metadata.types';

/**
 * How long after its last heartbeat a host still counts as attached: twice the
 * runner's 15-second heartbeat, so one missed beat is not an outage
 * (`product/versions/mvp/01-protocol.md`).
 */
export const HOST_ONLINE_WINDOW_SECONDS = 30;

/**
 * A host as a list reads it: the row, plus whether it is attached right now.
 *
 * `online` is not a column. It is a comparison against the heartbeat, made by
 * the database in the one presence read for the whole list — so every host in
 * one response is judged against one clock, and the list needs no call into the
 * relay to answer it.
 */
export interface HostPresence {
  host: HostEntity;
  online: boolean;
  /** What the machine is, from `host_inventory`; null until it has reported. */
  inventory: StoredHostInventory | null;
  /** Its last live numbers, from `host_presence`; null until its first link. */
  vitals: HostVitals | null;
  /** The network its current (or last) link came from. */
  network: HostNetwork | null;
}

/** What the burn hands back about the token it claimed, and nothing more. */
export interface RedeemedPairingToken {
  id: string;
  ownerUserId: string;
  /** The name the console gave the machine before it existed. */
  intendedName: string;
  /**
   * The id the statement recorded as the host this token created.
   *
   * It is minted before the statement runs, because the statement writes it —
   * which is also why the foreign key on that column is deferred to commit. The
   * host built from this row must carry it, or the response would name a row
   * nobody can read.
   */
  redeemedHostId: string;
}

export interface RedeemAndRegisterInput {
  /** SHA-256 of the presented secret — the only thing the burn matches on. */
  tokenHash: string;
  redeemedFromIp: string | null;
  now: Date;
  /**
   * Builds the host from the token that was actually claimed.
   *
   * A callback rather than a ready-made aggregate because who the host belongs
   * to and what it is called are columns of the row the burn locks, and the
   * burn is the only authority on whether that row may be spent. Constructing
   * the host first would mean building one for every forged token too.
   */
  host: (token: RedeemedPairingToken) => HostEntity;
}

/**
 * Every read a *person* makes takes an {@link AccessScope}, so "this query is
 * authorized" is something the compiler asks for rather than something a
 * handler remembers. The exceptions are named for what they are: a machine
 * authenticating itself has no access scope, a redemption is matched by a
 * secret rather than by an identity, and deleting an account is the system's.
 */
export interface HostRepositoryPort {
  /**
   * Hosts the caller can reach, newest first, each with its presence. Unpaired
   * hosts are left out unless `includeUnpaired` asks for them.
   */
  findAllWithPresence(
    scope: AccessScope,
    options?: { includeUnpaired?: boolean },
  ): Promise<HostPresence[]>;
  /** `None` both for a missing host and for one outside the caller's scope. */
  findOneByIdWithPresence(scope: AccessScope, id: string): Promise<Option<HostPresence>>;
  /** The same scoped read, for the write paths that do not care about presence. */
  findOneById(scope: AccessScope, id: string): Promise<Option<HostEntity>>;
  /**
   * A host read with no access scope, because the caller is the machine itself:
   * it proves who it is with a signature on a boot assertion, or with the secret
   * of the token it was paired by, and there is no person on the request to
   * scope by.
   */
  findOneByIdForMachine(id: string): Promise<Option<HostEntity>>;
  /**
   * Every host a person owns, paired or not, with no access scope: deleting
   * the account is the system acting on the account's own machines.
   */
  findOwnedBySystem(ownerUserId: string): Promise<HostEntity[]>;
  save(entity: HostEntity): Promise<HostEntity>;
  /**
   * Spend a pairing token and create the host it pairs, in **one transaction**. The
   * burn is one statement whose `WHERE` carries every reason a token may not be spent,
   * so two machines racing on one secret get one host and one rejection. It returns
   * the owner and intended name with the claimed row, so the host is built from what
   * was spent, not a second read. `None` means it claimed nothing: used, expired,
   * revoked or never real, deliberately indistinguishable.
   */
  redeemAndRegister(input: RedeemAndRegisterInput): Promise<Option<HostEntity>>;
}
