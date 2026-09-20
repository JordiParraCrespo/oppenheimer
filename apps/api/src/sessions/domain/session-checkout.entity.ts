import { randomUUID } from 'node:crypto';
import {
  ArgumentNotProvidedException,
  type CreateEntityProps,
  Entity,
} from '@oppenheimer/backend-ddd';

/** How the repository got onto the host, because cleanup differs. */
export type CheckoutMode = 'worktree' | 'clone';

export interface SessionCheckoutProps {
  organizationId: string;
  sessionId: string;
  /** The control plane's installation row, not GitHub's number. */
  installationId: string;
  /** GitHub's repository id, as the string the driver exchanges a bigint as. */
  githubRepoId: string;
  /** A display snapshot, refreshed whenever a checkout of the repository is created. */
  repositoryFullName: string;
  /** What the runner named the bare store, reported back. Null until it says. */
  storeDirectoryName: string | null;
  /** The directory inside the session. Never reused, even after removal. */
  directoryName: string;
  mode: CheckoutMode;
  /** What the session's branch was created from. */
  baseBranch: string;
  /** Always the session's own branch, never the base. */
  branch: string;
  worktreeCreatedAt: Date | null;
  pushedAt: Date | null;
  /** Set when the checkout is retired. The row is never deleted. */
  removedAt: Date | null;
}

export interface CreateSessionCheckoutProps {
  organizationId: string;
  sessionId: string;
  installationId: string;
  githubRepoId: string;
  repositoryFullName: string;
  directoryName: string;
  baseBranch: string;
  branch: string;
  mode?: CheckoutMode;
}

/**
 * One repository, checked out for one session, on the session's own branch.
 *
 * A checkout is also **where a repository is remembered**: there is no repository
 * table, because GitHub owns the list and the runner owns the disk. What a
 * checkout needs is GitHub's id, the installation that mints its token and a name
 * to display — three fields, inline, exactly as Better Auth's `account` row
 * carries its provider's ids rather than pointing at a `provider` table
 * (`product/versions/mvp/03-control-plane.md`).
 *
 * `mode` is recorded rather than guessed because cleanup differs: a worktree needs
 * `git worktree remove` and a prune, a clone is a directory removal, and reading
 * it back off the filesystem is how dangling git metadata accumulates.
 *
 * Rows are never hard-deleted. `removedAt` retires one, which is what keeps
 * `uq (sessionId, directoryName)` a permanent tombstone.
 */
export class SessionCheckoutEntity extends Entity<SessionCheckoutProps> {
  static create(create: CreateEntityProps<SessionCheckoutProps>): SessionCheckoutEntity {
    return new SessionCheckoutEntity(create);
  }

  static createNew(props: CreateSessionCheckoutProps): SessionCheckoutEntity {
    return new SessionCheckoutEntity({
      id: randomUUID(),
      props: {
        organizationId: props.organizationId,
        sessionId: props.sessionId,
        installationId: props.installationId,
        githubRepoId: props.githubRepoId,
        repositoryFullName: props.repositoryFullName,
        storeDirectoryName: null,
        directoryName: props.directoryName,
        // A worktree needs no network and no token, so the terminal can appear
        // before GitHub is involved. The runner falls back to a clone and says so.
        mode: props.mode ?? 'worktree',
        baseBranch: props.baseBranch,
        branch: props.branch,
        worktreeCreatedAt: null,
        pushedAt: null,
        removedAt: null,
      },
    });
  }

  get organizationId(): string {
    return this.props.organizationId;
  }

  get sessionId(): string {
    return this.props.sessionId;
  }

  get installationId(): string {
    return this.props.installationId;
  }

  get githubRepoId(): string {
    return this.props.githubRepoId;
  }

  get repositoryFullName(): string {
    return this.props.repositoryFullName;
  }

  get storeDirectoryName(): string | null {
    return this.props.storeDirectoryName;
  }

  get directoryName(): string {
    return this.props.directoryName;
  }

  get mode(): CheckoutMode {
    return this.props.mode;
  }

  get baseBranch(): string {
    return this.props.baseBranch;
  }

  get branch(): string {
    return this.props.branch;
  }

  get worktreeCreatedAt(): Date | null {
    return this.props.worktreeCreatedAt;
  }

  get pushedAt(): Date | null {
    return this.props.pushedAt;
  }

  get removedAt(): Date | null {
    return this.props.removedAt;
  }

  get isRemoved(): boolean {
    return this.props.removedAt !== null;
  }

  /** What the runner reported about the checkout it made. */
  reportCreated(mode: CheckoutMode, storeDirectoryName: string, at: Date): void {
    this.props.mode = mode;
    this.props.storeDirectoryName = storeDirectoryName;
    this.props.worktreeCreatedAt = at;
  }

  markPushed(at: Date): void {
    this.props.pushedAt = at;
  }

  /** Retire the checkout. Idempotent: the first removal is the one that counts. */
  remove(at: Date): void {
    this.props.removedAt = this.props.removedAt ?? at;
  }

  public validate(): void {
    if (!this.props.sessionId?.trim()) {
      throw new ArgumentNotProvidedException('A checkout must belong to a session');
    }
    if (!this.props.directoryName?.trim()) {
      throw new ArgumentNotProvidedException('A checkout must have a directory name');
    }
    if (!this.props.branch?.trim()) {
      throw new ArgumentNotProvidedException('A checkout must have a branch');
    }
  }
}
