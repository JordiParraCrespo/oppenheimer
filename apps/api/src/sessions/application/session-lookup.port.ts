import type { SessionShareViewer } from '../domain/session-share.entity';

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
  /**
   * The person the attach is judged as. Through a share, whoever shared the
   * session: a share opens what they could open, and no more.
   */
  userId: string;
  /** Present when the attach came through a share. */
  share?: AttachTicketShare;
  /**
   * `device`: the session's device screen, not a window's terminal.
   * `preview`: one of the session's ports, redeemed by its preview origin
   * rather than the attach socket (`product/versions/mvp/28-session-previews.md`).
   */
  target?: 'device' | 'preview';
  /** The port a `preview` ticket opens. */
  port?: number;
}

export interface AttachTicketShare {
  shareId: string;
  /** `read` access: the relay drops the attachment's input, the host attaches read-only. */
  readOnly: boolean;
  /** The signed-in guest, judged again on each re-check. */
  viewerUserId: string;
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
  /** Who started the session: the person a token minted for it acts for. */
  createdByUserId: string;
}

/**
 * What the relay may know about a session when a browser redeems an attach
 * ticket, and nothing more: enough to decide whether the socket opens and
 * which link it opens on.
 *
 * It is a port rather than the repository because the repository can append,
 * and the door that appends is `RECORD_SESSION_EVENTS`, which checks the host.
 */
export interface SessionLookupPort {
  /** Unscoped: the ticket already proved who asked, and the caller re-checks membership. */
  findAttachTarget(sessionId: string): Promise<SessionAttachTarget | null>;
  /**
   * Whether a share still opens this session for this guest, with the access
   * the ticket was minted with: the same judgment
   * (`SessionShareEntity.refusalFor`) its ticket passed at mint, asked again,
   * and a share since narrowed to `read` no longer admits a typing ticket,
   * nor one minted as somebody other than whoever shared it last: a share
   * set again by another member acts as them, and a terminal opened under
   * the first one closes. Unscoped: the ticket named the share.
   */
  shareAdmits(
    shareId: string,
    sessionId: string,
    sharedByUserId: string,
    viewer: SessionShareViewer,
    readOnly: boolean,
  ): Promise<boolean>;
  /** Unscoped: the runner proved which host it is, and the caller checks it matches. */
  findCredentialTarget(
    sessionId: string,
    checkoutId: string,
  ): Promise<SessionCredentialTarget | null>;
}
