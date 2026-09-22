/**
 * What the relay may know about a session when a browser redeems an attach
 * ticket, and nothing more: enough to decide whether the socket opens and
 * which link it opens on.
 *
 * It is a port rather than the repository because the repository can append,
 * and the door that appends is `RECORD_SESSION_EVENTS`, which checks the host.
 */
/** The Redis namespace of attach tickets, `attach:<random>`. */
export const ATTACH_TICKET_PREFIX = 'attach:';

/**
 * What an attach ticket authorises, as the issuing handler stores it and the
 * relay reads it back on redemption. Published here, beside the lookup that
 * re-checks it, because the two are one contract: the ticket names a session
 * and a person, the lookup says whether that session can still be attached to.
 */
export interface AttachTicket {
  sessionId: string;
  organizationId: string;
  window: number;
  userId: string;
}

export interface SessionAttachTarget {
  id: string;
  organizationId: string;
  hostId: string;
  /**
   * Three answers, because they end differently on the socket: `live` attaches;
   * `stopped` is tmux gone with the checkouts kept, so the console offers
   * Restart; `resolved` is the end. A boolean would give the last two one close
   * code and the person who pressed Stop a reconnect ladder instead of a button.
   */
  state: 'live' | 'stopped' | 'resolved';
}

/** What a `credentials.token` ask resolves to, before anything is minted. */
export interface SessionCredentialTarget {
  hostId: string;
  installationId: string;
  githubRepoId: number;
  /** `false` once the checkout was retired or the session resolved. */
  live: boolean;
}

export interface SessionLookupPort {
  /** Unscoped: the ticket already proved who asked, and the caller re-checks membership. */
  findAttachTarget(sessionId: string): Promise<SessionAttachTarget | null>;
  /** Unscoped: the runner proved which host it is, and the caller checks it matches. */
  findCredentialTarget(
    sessionId: string,
    checkoutId: string,
  ): Promise<SessionCredentialTarget | null>;
}
