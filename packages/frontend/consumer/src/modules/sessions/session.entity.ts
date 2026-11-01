import { assignProps } from '@oppenheimer/frontend-core';
import {
  CODING_AGENTS,
  type CodingAgentId,
  isCodingAgentId,
  type SessionEffort,
  type SessionPermission,
} from '@oppenheimer/shared/agents';
import {
  CLOUD_AGENT_LABELS,
  CLOUD_AGENT_PROVIDER_LABELS,
  type CloudAgentProviderId,
  type CloudAgentStatus,
  cloudAgentIsActive,
} from '@oppenheimer/shared/schemas/cloud-agent';
import type { SessionAgentId, SessionPlace } from '@oppenheimer/shared/schemas/session';
import type { SessionDecision } from '@oppenheimer/shared/schemas/session-decision';

/** The agent a session's tmux window 0 runs (`product/versions/mvp/00-scope.md`). */
/** What a session runs: a host's coding agent, or a vendor's in the cloud (`cursor`). */
export type SessionAgent = SessionAgentId;

/**
 * A cloud session's vendor half: whose agent it is, its page (which the
 * session's row opens), and what the vendor last said about its run.
 */
export interface SessionCloudRun {
  provider: CloudAgentProviderId;
  url: string | null;
  repositoryUrl: string;
  status: CloudAgentStatus;
  branch: string | null;
  pullRequestUrl: string | null;
  syncedAt: Date;
}

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

/** A delete asked for and not yet carried out by the host. */
export interface SessionCloseRequest {
  requestedAt: Date;
  /** Whether the delete may remove a worktree whose work is not pushed. */
  acceptUnpushedWork: boolean;
}

/** The host's refusal of a delete: its catalog code (`GIT_003`) and its own words. */
export interface SessionCloseRefusal {
  code: string;
  detail: string | null;
}

/** How the agent was started: the composer's foot row, as the API returns it. */
export interface SessionLaunch {
  /** Null runs the agent's own default. */
  model: string | null;
  /** Null for an agent with no approvals (the blank terminal). */
  permission: SessionPermission | null;
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
 * A single-use pass to one window of a session's terminal, as
 * `POST /sessions/{id}/attach-ticket` mints it. It travels in
 * `Sec-WebSocket-Protocol` and is redeemed by opening `url` on the API's origin.
 */
/** One port a session's processes listen on, which its Browser tab can open. */
export interface SessionPort {
  port: number;
  /** The command listening on it ("node"), when the host said. */
  process: string | null;
}

/**
 * What the session's host said about its ports: the ports, or why it said
 * nothing (no link now, or a runner that cannot list them).
 */
export interface SessionPorts {
  state: 'listed' | 'host_offline' | 'not_supported';
  ports: SessionPort[];
}

/** Where a session's port opens: its preview origin, with a ticket that lives a minute. */
export interface SessionPreview {
  url: string;
  expiresAt: Date;
}

export interface AttachTicket {
  ticket: string;
  /** A path on the API's own origin, e.g. `/api/v1/relay/attach`. */
  url: string;
  expiresAt: Date;
  window: number;
}

/**
 * How a session's terminal is opened to people outside the workspace, as its
 * members see it: one share per session, at one address, `/s/<slug>`.
 */
export interface SessionShare {
  id: string;
  slug: string;
  /** `people`, the accounts on `people`; `link`, anyone signed in with the address. */
  audience: 'people' | 'link';
  access: 'read' | 'write';
  /** Lowercased emails; empty unless `audience` is `people`. */
  people: string[];
  /** `null` until its owner stops sharing. */
  expiresAt: Date | null;
  /** The person the share acts as, while their account is active. */
  sharedBy: { id: string; name: string; email: string } | null;
  updatedAt: Date;
}

/** What a guest may know about the session a share opens. */
export interface SharedSession {
  name: string;
  state: 'live' | 'stopped';
  access: 'read' | 'write';
  sharedBy: string | null;
  expiresAt: Date | null;
}

/** What a {@link SessionEntity} is made from: every field, the defaulted ones optional. */
export type SessionEntityProps = Pick<
  SessionEntity,
  | 'id'
  | 'organizationId'
  | 'projectId'
  | 'hostId'
  | 'name'
  | 'slug'
  | 'agent'
  | 'launch'
  | 'state'
  | 'lifecycle'
  | 'cwdCheckoutId'
  | 'checkouts'
  | 'stoppedAt'
  | 'hints'
  | 'createdAt'
  | 'place'
  | 'folderPath'
> &
  Partial<
    Pick<
      SessionEntity,
      | 'closeRequest'
      | 'closeRefusal'
      | 'observedSince'
      | 'lastEventAt'
      | 'stateSeq'
      | 'decision'
      | 'cloud'
      | 'cloudSessionId'
    >
  >;

/**
 * A session as the console needs it: a terminal, an agent, and where it runs
 * on a host — a set of checkouts the runner made (`worktree`), or a folder
 * already there that nothing is written into (`folder`,
 * `product/versions/mvp/24-session-places.md`).
 *
 * Two state words, because the API has two and they answer different questions:
 * `state` is the derived group the sidebar dot shows, and `lifecycle` is the
 * stored fold of the log.
 */
export class SessionEntity {
  readonly id!: string;
  readonly organizationId!: string;
  readonly projectId!: string;
  /** Null for a cloud session launched at its vendor, which no host started. */
  readonly hostId!: string | null;
  readonly name!: string;
  /** The directory name and the last segment of the branch. Immutable. */
  readonly slug!: string;
  readonly agent!: SessionAgent;
  readonly launch!: SessionLaunch;
  readonly state!: SessionGroup;
  readonly lifecycle!: SessionState;
  readonly cwdCheckoutId!: string | null;
  readonly checkouts!: SessionCheckoutEntity[];
  readonly stoppedAt!: Date | null;
  /** What the control plane could not do for the request that returned this. */
  readonly hints!: string[];
  readonly createdAt!: Date;
  readonly place!: SessionPlace;
  /** The folder a `folder` session runs in, absolute; null for a worktree session. */
  readonly folderPath!: string | null;
  /**
   * A delete the host has not carried out yet: the close is the host's to do, so
   * the session stays until it answers, and its next connection is sent it again.
   */
  readonly closeRequest: SessionCloseRequest | null = null;
  /** Why the host refused the last delete, until it is asked again. */
  readonly closeRefusal: SessionCloseRefusal | null = null;
  /**
   * When the agent entered the state it was last observed in; null until a
   * second report of it. A blocked wait is named by it (the Inbox).
   */
  readonly observedSince: Date | null = null;
  /** When the session's log last moved. */
  readonly lastEventAt: Date | null = null;
  /** Bumped on every change of `lifecycle`: one failure or launch told from the next. */
  readonly stateSeq: number = 0;
  /**
   * What the agent waits on you to decide, as the host read it: a question it
   * asked or a permission dialog (`29-inbox.md` slice 4); null when nothing is.
   */
  readonly decision: SessionDecision | null = null;
  /** The vendor half of a cloud session the control plane launched (Cursor's); null otherwise. */
  readonly cloud: SessionCloudRun | null = null;
  /**
   * A cloud session's id at its vendor, once its host has started it:
   * Claude Code's session (`session_…`) or Codex's task (`task_…`); null
   * before, and for every other session.
   */
  readonly cloudSessionId: string | null = null;

  constructor(props: SessionEntityProps) {
    assignProps(this, props);
  }

  /**
   * Whether it runs in a vendor's cloud, with no terminal here: Claude Code's,
   * whose page is claude.ai/code, or one launched at its vendor (`cloud`).
   */
  get isCloud(): boolean {
    return this.place === 'cloud';
  }

  /** Whether its vendor's run may still change on its own: the list keeps asking while it does. */
  get isCloudWorking(): boolean {
    return this.cloud !== null && cloudAgentIsActive(this.cloud.status);
  }

  /**
   * Where it runs, as one key a filter can compare: its host's id, or
   * `cloud:<vendor>` for a cloud session.
   */
  get runsOn(): string {
    return this.cloud ? `cloud:${this.cloud.provider}` : (this.hostId ?? '');
  }

  /**
   * The cloud session's page at its vendor, once it has one: claude.ai/code
   * for Claude Code's, chatgpt.com/codex for a Codex task.
   */
  get cloudUrl(): string | null {
    if (!this.cloudSessionId) return null;
    const id = encodeURIComponent(this.cloudSessionId);
    return this.agent === 'codex'
      ? `https://chatgpt.com/codex/tasks/${id}`
      : `https://claude.ai/code/${id}`;
  }

  /**
   * The command that brings the cloud session's work into a terminal: Claude
   * Code's branch and conversation (`claude --teleport`), or a Codex task's
   * diff, applied to the checkout it runs in (`codex apply`).
   */
  get teleportCommand(): string | null {
    if (!this.cloudSessionId) return null;
    return this.agent === 'codex'
      ? `codex apply ${this.cloudSessionId}`
      : `claude --teleport ${this.cloudSessionId}`;
  }

  /** Whether a delete is on its way to the host: the row reads "Deleting…". */
  get isClosing(): boolean {
    return this.closeRequest !== null;
  }

  /** Whether it runs in a folder of the host's own, with no checkout and nothing to push. */
  get isFolder(): boolean {
    return this.place === 'folder';
  }

  /**
   * Whether a terminal can be attached to right now.
   *
   * `open` and not stopped: a session the host has built and not ended. A
   * `starting` session has no PTY yet and a `resolved` one never will again.
   */
  get isLive(): boolean {
    return this.lifecycle === 'open' && this.stoppedAt === null;
  }

  /** Whether the host closed it: pushed, removed its worktrees, done for good. */
  get isResolved(): boolean {
    return this.lifecycle === 'resolved';
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

  /**
   * `repo · branch` for the status line, with a count when there are more; the
   * folder's path for a folder session (`folderLabel` shortens it under home);
   * the repository and, once it pushed one, the vendor's branch for a cloud one.
   */
  get scopeLabel(): string | null {
    if (this.isFolder) return this.folderPath;
    if (this.cloud) {
      const repository = repositoryNameOf(this.cloud.repositoryUrl);
      return this.cloud.branch ? `${repository} · ${this.cloud.branch}` : repository;
    }
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

  /** The same session in another project: what a list draws while a move to it is on its way. */
  inProject(projectId: string): SessionEntity {
    return this.with({ projectId });
  }

  /**
   * A copy with `overrides` applied. The copy is of every field the session
   * holds, so a field added later is carried without being listed here.
   */
  with(overrides: Partial<SessionEntityProps>): SessionEntity {
    return new SessionEntity({ ...this, ...overrides });
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
export type CreateSessionInput = CreateSessionCommon &
  (CreateWorktreeSession | CreateFolderSession);

/**
 * A new worktree: the runner clones and cuts a branch. With `cloud`, the host
 * starts the task in Claude Code's cloud from that repository instead, and
 * keeps nothing: Claude Code only, with a prompt.
 */
export interface CreateWorktreeSession {
  /**
   * At least one, at most `MAX_SESSION_CHECKOUTS`, each a different repository: the
   * runner makes one worktree per checkout. The first is where the agent starts
   * unless `cwdGithubRepoId` names another.
   */
  checkouts: [CreateSessionCheckout, ...CreateSessionCheckout[]];
  /** Which checkout the agent is launched in. Must name one of `checkouts`. */
  cwdGithubRepoId?: number;
  cloud?: boolean;
  /**
   * A Codex cloud session's environment, by id: absent, the host starts the
   * task in the environment linked to the repository.
   */
  codexEnvironment?: string;
  folder?: never;
}

/** A folder already on the host, opened as it is: nothing is cloned or written. */
export interface CreateFolderSession {
  /** Absolute, on the host. */
  folder: string;
  checkouts?: never;
  cwdGithubRepoId?: never;
  cloud?: never;
  codexEnvironment?: never;
}

interface CreateSessionCommon {
  hostId: string;
  agent: CodingAgentId;
  launch?: Partial<SessionLaunch>;
  /** The composer's first task. It names the session and reaches the agent. */
  prompt?: string;
  /** Images uploaded with `uploadAttachment`, given to the agent with the task. */
  attachmentIds?: string[];
  name?: string;
  projectId?: string;
}

/**
 * What New session posts for a session in a vendor's cloud: the vendor, the
 * project, one repository, the first task and a model. There is no host,
 * folder or permission level to name.
 */
export interface StartCloudSessionInput {
  provider: CloudAgentProviderId;
  projectId?: string;
  checkout: CreateSessionCheckout;
  prompt: string;
  /** Absent is the vendor's own default. */
  model?: string;
}

/** What a host is asked to get ready while New session is still being written. */
export interface PrepareSessionInput {
  hostId: string;
  checkouts: [CreateSessionCheckout, ...CreateSessionCheckout[]];
}

/** An image uploaded for a first task, waiting for the create that names it. */
export interface SessionAttachment {
  id: string;
  mediaType: string;
  size: number;
}

/** `owner/name` of a GitHub repository URL, the URL itself for anything else. */
export function repositoryNameOf(url: string): string {
  const match = /^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(url);
  return match ? match[1] : url;
}

/** What an agent is called on screen: the host catalog's name, or a cloud agent's vendor's. */
export function sessionAgentLabel(agent: SessionAgent): string {
  return isCodingAgentId(agent) ? CODING_AGENTS[agent].label : CLOUD_AGENT_LABELS[agent];
}

/** What a cloud vendor is called on screen, as a place a session runs. */
export function cloudProviderLabel(provider: CloudAgentProviderId): string {
  return CLOUD_AGENT_PROVIDER_LABELS[provider];
}
