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
 * Until the relay exists this is bound to an adapter that records
 * `session.dispatch_pending` and nothing else, which is why every method returns the
 * same small outcome rather than a job id: the slice is complete without a host
 * because every read, write and state rule is testable without one.
 */
export interface SessionDispatchOutcome {
  /** Whether the job reached a live link to the host. */
  delivered: boolean;
  /**
   * Structured hints for the caller. `host_offline` is the one the console has a
   * use for; a runner must not be able to say it about itself, which is why the
   * link's hint vocabulary and this one are two schemas.
   */
  hints: string[];
}

/**
 * What the host is told to make. Every path segment is a unique-constrained
 * column, so the runner derives
 * `workspaces/<organizationSlug>/projects/<projectSlug>/sessions/<sessionSlug>/`
 * without asking — and only the two names it cannot read off the session travel
 * here. The workspace's own slug is not among them: it belongs to the organization
 * row, which the implementation reads when it builds the job, rather than being
 * carried through a module that has no business loading it.
 */
export interface SessionLaunchSpec {
  projectSlug: string;
  /** Always the session's own branch, created from each checkout's base. */
  branch: string;
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
  /** Remove one checkout's worktree, with the same refuse-on-unpushed-work posture. */
  removeCheckout(
    session: WorkSessionEntity,
    checkout: SessionCheckoutEntity,
  ): Promise<SessionDispatchOutcome>;
}
