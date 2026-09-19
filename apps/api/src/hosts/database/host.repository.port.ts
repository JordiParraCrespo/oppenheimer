import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Option } from 'oxide.ts';
import type { HostEntity } from '../domain/host.entity';

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
 * the database inside the same query that returns the rows — so every host in
 * one response is judged against one clock, and the list needs no call into the
 * relay to answer it.
 */
export interface HostPresence {
  host: HostEntity;
  online: boolean;
}

export interface RedeemAndRegisterInput {
  /** SHA-256 of the presented secret — the only thing the burn matches on. */
  tokenHash: string;
  /** The host to create if, and only if, the burn claims the token. */
  host: HostEntity;
  redeemedFromIp: string | null;
  now: Date;
}

/**
 * Port for the host aggregate.
 *
 * Every read a *person* makes takes an {@link AccessScope}, so "this query is
 * authorized" is something the compiler asks for rather than something a
 * handler remembers. The two exceptions are named for what they are: a machine
 * authenticating itself has no access scope, and a redemption is matched by a
 * secret rather than by an identity.
 */
export interface HostRepositoryPort {
  /** Hosts the caller can reach, newest first, each with its presence. */
  findAllWithPresence(scope: AccessScope): Promise<HostPresence[]>;
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
  save(entity: HostEntity): Promise<HostEntity>;
  /**
   * Spend a pairing token and create the host it pairs, in **one transaction**.
   *
   * The burn is a single statement whose `WHERE` carries every reason a token
   * may not be spent, so two machines racing on the same secret produce one host
   * and one rejection rather than two hosts. `None` means the statement claimed
   * nothing — used, expired, revoked or never real, deliberately
   * indistinguishable from each other.
   */
  redeemAndRegister(input: RedeemAndRegisterInput): Promise<Option<HostEntity>>;
}
