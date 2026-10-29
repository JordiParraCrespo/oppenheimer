import type { SessionFileMediaType } from '@oppenheimer/shared/protocol';
import type { SessionCheckoutEntity } from '../domain/session-checkout.entity';
import type { SessionLaunchFile } from '../domain/session-launch-file.types';
import type { WorkSessionEntity } from '../domain/work-session.entity';
import type { SealedRepositoryToken } from './repository-token.factory';

export interface SessionDispatchOutcome {
  /** Whether the job reached a live link to the host. */
  delivered: boolean;
  /**
   * Structured hints for the caller. `host_offline` is the one the console has a
   * use for; a runner must not be able to say it about itself, which is why the
   * link's hint vocabulary and this one are two schemas. `not_supported` is the
   * other: the host is reachable but cannot take the operation (no frame on the
   * wire yet, or a runner whose `hello` did not name the capability), so nothing
   * was sent.
   */
  hints: string[];
}

/**
 * What the host is told to make. Every path segment is an id or a
 * unique-constrained column, so the runner derives
 * `<account>/<workspaceId>/sessions/<sessionSlug>/` without asking
 * (`product/versions/mvp/24-session-places.md` §2) — the account being the one
 * it was paired with — and only the names it cannot read off the session
 * travel here.
 */
export interface SessionLaunchSpec {
  /** The workspace's slug, read through `WORKSPACE_LOOKUP`. */
  organizationSlug: string;
  /** The workspace the session is in: the session's organization. */
  workspaceId: string;
  /**
   * The session's own branch, created from each checkout's base. Absent for a
   * folder session, which runs on whatever branch the folder is on.
   */
  branch?: string;
  /**
   * The first task, to be given to the agent once the host has it up.
   *
   * It travels here rather than on the session because it is **not** a column:
   * a prompt is the person's own sentence, and the log and the host are the two
   * places it belongs (`product/versions/mvp/03-control-plane.md`). An
   * implementation reads the launch options off the session itself, which are
   * folded.
   */
  prompt?: string;
  /**
   * Images attached to the first task, already parked for the host under
   * these ids. Only the ids travel; the runner pulls the bytes. They come from
   * the log's `prompt.first`, like the prompt, so the hello reconciliation
   * resends them with it.
   */
  images?: SessionLaunchFile[];
  /**
   * A cloud session's repository token, minted for its one checkout and sealed
   * to the host (`SessionLaunchCredentials`): the host fetches with it, since
   * nothing on the host names a live checkout for a credential ask to find.
   */
  cloud?: SealedRepositoryToken;
  /**
   * Why this launch cannot be sent yet, when something it must carry could not
   * be made: the dispatch answers it as its hint and sends nothing, and the
   * hello reconciliation builds the launch again.
   */
  withheld?: 'host_offline';
}

export interface SessionCloseSpec {
  /**
   * Whether the caller accepts losing unpushed work. Closing pushes each branch and
   * then removes the worktrees, and it refuses when a checkout has work that is not
   * home — relaying git's own refusal rather than paraphrasing it, and never passing
   * `--force`.
   */
  acceptUnpushedWork: boolean;
}

/**
 * A repository a host is to get ready before any session asks for it: its mirror
 * cloned or fetched and a spare worktree made at `baseBranch` (02 §5).
 */
export interface SessionPrepareSpec {
  /** Whose stores to warm: the caller's workspace, under the host's account (24 §2). */
  workspaceId: string;
  githubRepoId: number;
  repositoryFullName: string;
  baseBranch: string;
  /** An installation token narrowed to this repository, sealed to the host's key. Base64. */
  sealed: string;
  expiresAt: Date;
}

/** A picture for a window's prompt; the runner saves it and pastes its path. */
export interface SessionFileSpec {
  window: number;
  /** What the bytes are by their magic bytes, never the browser's label. */
  mediaType: SessionFileMediaType;
  data: Buffer;
}

/**
 * Keys for a window nobody need be watching, typed one write each, `gapMs` apart:
 * a picker redraws after each key and reads the next against what it drew.
 */
export interface SessionKeysSpec {
  window: number;
  keys: readonly string[];
  gapMs: number;
}

/** A pattern the runner is to watch a session's screen for, under the watch's id. */
export interface SessionTerminalWatchSpec {
  watchId: string;
  pattern: string;
}

/**
 * What the module that owns the runner link implements so a session's work reaches a
 * host.
 *
 * A port, not a queue: the desired state is the session row and the outbox is already
 * durable, so there is no `jobs` table and nothing here promises delivery. An
 * implementation says whether it got the job onto a link; the log records the answer.
 *
 * **An implementation never writes the log.** A user action's entries are appended
 * by the command handler in the same transaction as its row change; a dispatcher that
 * also appended would split one click across two transactions.
 */
export interface SessionDispatchPort {
  /**
   * Make the directories, the checkouts and window 0, then launch the agent — or,
   * for a folder session, only window 0 in that folder. A runner that does not
   * take folder sessions is sent nothing and answered `not_supported`.
   */
  create(session: WorkSessionEntity, spec: SessionLaunchSpec): Promise<SessionDispatchOutcome>;
  /** End the agent and the tmux session. Every checkout stays on disk. */
  stop(session: WorkSessionEntity): Promise<SessionDispatchOutcome>;
  /** Recreate window 0 in the same worktrees — what a host reboot needs. */
  restart(session: WorkSessionEntity, spec: SessionLaunchSpec): Promise<SessionDispatchOutcome>;
  /** Push each branch, then remove the worktrees and prune. */
  close(session: WorkSessionEntity, spec: SessionCloseSpec): Promise<SessionDispatchOutcome>;
  addCheckout(
    session: WorkSessionEntity,
    checkout: SessionCheckoutEntity,
    spec: SessionLaunchSpec,
  ): Promise<SessionDispatchOutcome>;
  /** Give a window's program an image: saved on the host, its path pasted in. */
  pasteFile(session: WorkSessionEntity, image: SessionFileSpec): Promise<SessionDispatchOutcome>;
  /**
   * Type keys into a window as `session.input`, one frame per key, in order.
   * `delivered` only when every key reached the link.
   */
  typeKeys(session: WorkSessionEntity, spec: SessionKeysSpec): Promise<SessionDispatchOutcome>;
  /**
   * Have the runner scan the session's screen for a pattern
   * (`session.watch`); a runner whose hello did not name `session.watch` is
   * sent nothing and answered `not_supported`.
   */
  watchTerminal(
    session: WorkSessionEntity,
    spec: SessionTerminalWatchSpec,
  ): Promise<SessionDispatchOutcome>;
  /** Stop a watch `watchTerminal` started. */
  unwatchTerminal(session: WorkSessionEntity, watchId: string): Promise<SessionDispatchOutcome>;
  /** Remove one checkout's worktree, with the same refuse-on-unpushed-work posture. */
  removeCheckout(
    session: WorkSessionEntity,
    checkout: SessionCheckoutEntity,
  ): Promise<SessionDispatchOutcome>;
  /**
   * Why `prepare` would send nothing to this host right now — `host_offline`
   * or `not_supported` — or null when it would. Asked first, so no token is
   * minted for a host that cannot take it.
   */
  prepareRefusal(hostId: string): 'host_offline' | 'not_supported' | null;
  /** Get a repository ready on a host for a session not yet asked for. */
  prepare(hostId: string, spec: SessionPrepareSpec): SessionDispatchOutcome;
}
