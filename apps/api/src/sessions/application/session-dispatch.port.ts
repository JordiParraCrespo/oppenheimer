import type { SessionImageMediaType } from '@oppenheimer/shared/protocol';
import type { SessionCheckoutEntity } from '../domain/session-checkout.entity';
import type { WorkSessionEntity } from '../domain/work-session.entity';

/**
 * What the module that owns the runner link implements so a session's work reaches
 * a host.
 *
 * It is a port, not a queue: the desired state is already the session row and the
 * outbox is already a durable queue, so there is no `jobs` table and nothing here
 * promises delivery. An implementation says whether it got the job onto a link, and
 * the session's log is where that answer is written down.
 *
 * **An implementation never writes the log.** One user action is one entry,
 * appended by the command handler in the same transaction as the row change it
 * implies. A dispatcher that also appended would make a click two entries in two
 * transactions. Until the relay exists this is bound to an adapter that answers
 * `{ delivered: false, hints: ['host_offline'] }` and does nothing else, which is
 * why every method returns the same small outcome rather than a job id.
 */
export interface SessionDispatchOutcome {
  /** Whether the job reached a live link to the host. */
  delivered: boolean;
  /**
   * Structured hints for the caller. `host_offline` is the one the console has a
   * use for; a runner must not be able to say it about itself, which is why the
   * link's hint vocabulary and this one are two schemas. `not_supported` is the
   * other: the host is reachable and the operation has no frame on the wire yet,
   * so nothing was sent and the row is ahead of the host.
   */
  hints: string[];
}

/**
 * What the host is told to make. Every path segment is a unique-constrained
 * column, so the runner derives
 * `workspaces/<organizationSlug>/projects/<projectSlug>/sessions/<sessionSlug>/`
 * without asking — and only the names it cannot read off the session travel
 * here. The workspace's slug is one of them: it belongs to the organization row,
 * which this module asks `organizations/` for through its published port, so the
 * dispatcher never reads another module's table.
 */
export interface SessionLaunchSpec {
  /** The workspace's slug: a path segment on the host, read through `WORKSPACE_LOOKUP`. */
  organizationSlug: string;
  projectSlug: string;
  /** Always the session's own branch, created from each checkout's base. */
  branch: string;
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

/** A picture for a window's prompt; the runner saves it and pastes its path. */
export interface SessionImageSpec {
  window: number;
  /** What the bytes are by their magic bytes, never the browser's label. */
  mediaType: SessionImageMediaType;
  data: Buffer;
}

export interface SessionDispatchPort {
  /** Make the directories, the checkouts and window 0, then launch the agent. */
  create(session: WorkSessionEntity, spec: SessionLaunchSpec): Promise<SessionDispatchOutcome>;
  /** End the agent and the tmux session. Every checkout stays on disk. */
  stop(session: WorkSessionEntity): Promise<SessionDispatchOutcome>;
  /** Recreate window 0 in the same worktrees — what a host reboot needs. */
  restart(session: WorkSessionEntity, spec: SessionLaunchSpec): Promise<SessionDispatchOutcome>;
  /** Push each branch, then remove the worktrees and prune. */
  close(session: WorkSessionEntity, spec: SessionCloseSpec): Promise<SessionDispatchOutcome>;
  /** Add a repository to a session that is already running. */
  addCheckout(
    session: WorkSessionEntity,
    checkout: SessionCheckoutEntity,
    spec: SessionLaunchSpec,
  ): Promise<SessionDispatchOutcome>;
  /** Give a window's program an image: saved on the host, its path pasted in. */
  pasteImage(session: WorkSessionEntity, image: SessionImageSpec): Promise<SessionDispatchOutcome>;
  /** Remove one checkout's worktree, with the same refuse-on-unpushed-work posture. */
  removeCheckout(
    session: WorkSessionEntity,
    checkout: SessionCheckoutEntity,
  ): Promise<SessionDispatchOutcome>;
}
