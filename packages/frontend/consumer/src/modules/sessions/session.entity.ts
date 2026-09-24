import type { CodingAgentId, SessionEffort, SessionPermission } from '@oppenheimer/shared/agents';

/** The agent a session's tmux window 0 runs (`product/versions/mvp/00-scope.md`). */
export type SessionAgent = CodingAgentId;

/**
 * The **derived group**: what the sidebar's dot shows, computed by the control
 * plane on every read and never stored.
 *
 * It is organised by what needs you rather than by what the process is doing,
 * which is why it is not the lifecycle below: a session that failed, one whose
 * agent has been blocked for thirty seconds and one whose launch has sat unready
 * for a minute are all `waiting-on-you`, however differently they got there
 * (`product/versions/mvp/03-control-plane.md`).
 */
export type SessionGroup =
  | 'working'
  | 'waiting-on-you'
  | 'ready-for-review'
  | 'landing'
  | 'idle'
  | 'resolved';

/**
 * The **stored lifecycle**: the fold of the session's append-only log.
 *
 * It answers whether the work is finished, not whether a process is running —
 * stopping a session does not move it, because the worktrees are still there and
 * the work is exactly as unfinished as it was.
 */
export type SessionState = 'starting' | 'open' | 'failed' | 'resolved';

/** How the agent was started: the composer's foot row, as the API returns it. */
export interface SessionLaunch {
  /** Null runs the agent's own default. */
  model: string | null;
  permission: SessionPermission;
  /** Null leaves the agent its own default. */
  effort: SessionEffort | null;
}

/**
 * One repository checked out for one session, on its own branch.
 *
 * A session has zero or more: zero is a real session working in its own
 * directory with no git at all. `repository`, `baseBranch` and `branch` live
 * here rather than on the session because with several checkouts they are
 * per-checkout facts.
 */
export class SessionCheckoutEntity {
  constructor(
    public readonly id: string,
    public readonly installationId: string,
    /** GitHub's own id, as a string because the column is a bigint. */
    public readonly githubRepoId: string,
    /** A display snapshot of `owner/repo` from when the checkout was created. */
    public readonly repositoryFullName: string,
    public readonly directoryName: string,
    /** What the session's branch was created from. */
    public readonly baseBranch: string,
    /** Always the session's own branch, never the base. */
    public readonly branch: string,
  ) {}

  /** Just `repo`, for a status line that has no room for the owner. */
  get repositoryName(): string {
    return this.repositoryFullName.split('/').at(-1) ?? this.repositoryFullName;
  }
}

/**
 * A session as the console needs it: a terminal, an agent, and a set of
 * checkouts on a host.
 *
 * Two state words, because the API has two and they answer different questions:
 * `state` is the derived group the sidebar dot shows, and `lifecycle` is the
 * stored fold of the log. Collapsing them was the error an earlier version of
 * this file made — it carried one `running | idle | stopped` union that the API
 * had already stopped sending.
 */
/**
 * A single-use pass to one window of a session's terminal, as
 * `POST /sessions/{id}/attach-ticket` mints it. It travels in
 * `Sec-WebSocket-Protocol` and is redeemed by opening `url` on the API's origin.
 */
export interface AttachTicket {
  ticket: string;
  /** A path on the API's own origin, e.g. `/api/v1/relay/attach`. */
  url: string;
  expiresAt: Date;
  window: number;
}

/**
 * What became of an image pasted into a session: whether it reached a live
 * link to the host. Success past that is the image's path appearing in the
 * agent's prompt; a runner that refused it says so in the session's log.
 */
export interface PastedImage {
  delivered: boolean;
  /** `host_offline` when no link to the host existed and nothing was sent. */
  hostOffline: boolean;
}

export class SessionEntity {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly projectId: string,
    public readonly hostId: string,
    public readonly name: string,
    /** The directory name and the last segment of the branch. Immutable. */
    public readonly slug: string,
    public readonly agent: SessionAgent,
    public readonly launch: SessionLaunch,
    public readonly state: SessionGroup,
    public readonly lifecycle: SessionState,
    public readonly cwdCheckoutId: string | null,
    public readonly checkouts: SessionCheckoutEntity[],
    public readonly stoppedAt: Date | null,
    /** What the control plane could not do for the request that returned this. */
    public readonly hints: string[],
    public readonly createdAt: Date,
  ) {}

  /**
   * Whether a terminal can be attached to right now.
   *
   * `open` and not stopped: a session the host has built and not ended. A
   * `starting` session has no PTY yet and a `resolved` one never will again.
   */
  get isLive(): boolean {
    return this.lifecycle === 'open' && this.stoppedAt === null;
  }

  /** Whether the host has not picked this session up yet. */
  get isProvisioning(): boolean {
    return this.lifecycle === 'starting';
  }

  /** The checkout the agent was launched in, or the first one, or none. */
  get cwdCheckout(): SessionCheckoutEntity | undefined {
    const named = this.checkouts.find((checkout) => checkout.id === this.cwdCheckoutId);
    return named ?? this.checkouts[0];
  }

  /** `repo · branch` for the status line, with a count when there are more. */
  get scopeLabel(): string | null {
    const checkout = this.cwdCheckout;
    if (!checkout) return null;
    const extra = this.checkouts.length - 1;
    const base = `${checkout.repositoryName} · ${checkout.branch}`;
    return extra > 0 ? `${base} +${extra}` : base;
  }

  /** Whether the command that made this session never reached its host. */
  get isHostOffline(): boolean {
    return this.hints.includes('host_offline');
  }
}

/** One repository to check out, as New session names it. */
export interface CreateSessionCheckout {
  /** Our installation row's UUID, never GitHub's numeric installation id. */
  installationId: string;
  githubRepoId: number;
  /** Absent takes the repository's default branch. */
  baseBranch?: string;
}

/** What New session posts: the chips, the foot row, and the first task. */
export interface CreateSessionInput {
  hostId: string;
  agent: SessionAgent;
  checkouts: CreateSessionCheckout[];
  /** Which checkout the agent is launched in. Must name one of `checkouts`. */
  cwdGithubRepoId?: number;
  launch?: Partial<SessionLaunch>;
  /** The composer's first task. It names the session and reaches the agent. */
  prompt?: string;
  name?: string;
  projectId?: string;
}
