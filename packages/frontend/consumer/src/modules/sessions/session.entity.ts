/** The agent a session's tmux window 0 runs (`product/versions/mvp/00-scope.md`). */
export type SessionAgent = 'claude-code' | 'codex';

/**
 * Where a session is in its life, derived by the control plane from the
 * session's events (`product/versions/mvp/03-control-plane.md`: events are the
 * source of truth, state is derived).
 */
export type SessionState = 'starting' | 'running' | 'idle' | 'stopped' | 'failed';

/**
 * A session as the console needs it: a git worktree on a host with a tmux
 * terminal running an agent, streamed to the browser. The sidebar lists these
 * with a state dot, name and age.
 */
export class SessionEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly hostId: string,
    /** `owner/repo`, as GitHub names it. */
    public readonly repository: string,
    public readonly baseBranch: string,
    public readonly branch: string,
    public readonly agent: SessionAgent,
    public readonly state: SessionState,
    public readonly createdAt: Date,
  ) {}

  /** Whether the terminal can be attached to right now. */
  get isLive(): boolean {
    return this.state === 'running' || this.state === 'idle';
  }
}

/** The four chips of New session, plus the optional name. */
export interface CreateSessionInput {
  hostId: string;
  repository: string;
  baseBranch: string;
  agent: SessionAgent;
  name?: string;
}
