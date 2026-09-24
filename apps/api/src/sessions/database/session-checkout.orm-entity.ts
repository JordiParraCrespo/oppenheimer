import { CreatedAtColumn, TimestampColumn } from '@oppenheimer/backend-ddd';
import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { CheckoutMode } from '../domain/session-checkout.entity';

/**
 * One repository, checked out for one session — and the only place a repository is
 * remembered, because there is no repository table.
 *
 * Its two composite foreign keys are the point of the row's shape:
 * `(organizationId, sessionId) → work_session (organizationId, id)` and
 * `(organizationId, installationId) → github_installation (organizationId, id)`.
 * Together they make a checkout through another workspace's installation
 * **unrepresentable** rather than merely unchecked — the escalation an earlier
 * draft left to a handler. Whether `githubRepoId` is inside that installation is
 * GitHub's to say, and it says so at every token mint.
 *
 * Two partial uniques, and they say different things. `(sessionId, githubRepoId)
 * WHERE removedAt IS NULL` lets a repository be re-added after removal;
 * `(sessionId, directoryName)` is unconditional, because a directory name is
 * never reused inside a session — the coding agents key their conversation state
 * by working directory, so a new checkout on a retired name would inherit a
 * stranger's history.
 */
@Entity('session_checkout')
@Index('IDX_session_checkout_session', ['sessionId'])
@Index('UQ_session_checkout_session_repo', ['sessionId', 'githubRepoId'], {
  unique: true,
  where: '"removedAt" IS NULL',
})
@Unique('UQ_session_checkout_session_directory', ['sessionId', 'directoryName'])
@Unique('UQ_session_checkout_session_id', ['sessionId', 'id'])
export class SessionCheckoutOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  sessionId!: string;

  /** The control plane's installation row, which is what mints this repository's token. */
  @Column({ type: 'uuid' })
  installationId!: string;

  /** GitHub's repository id. A bigint, which the driver exchanges as a string. */
  @Column({ type: 'bigint' })
  githubRepoId!: string;

  /** `owner/repo` as GitHub spells it — a display snapshot, never used for access. */
  @Column({ type: 'varchar' })
  repositoryFullName!: string;

  /**
   * What the runner named the bare store under `repos/`. A fact it reports, because
   * the runner owns the disk: a worktree's `.git` file points at its store by
   * absolute path, so the store can never move, while `repositoryFullName` changes
   * on every GitHub rename.
   */
  @Column({ type: 'varchar', nullable: true })
  storeDirectoryName!: string | null;

  /** The directory inside the session. Derived, and never reissued. */
  @Column({ type: 'varchar' })
  directoryName!: string;

  /** Recorded rather than guessed, because cleanup differs between the two. */
  @Column({ type: 'varchar', default: 'worktree' })
  mode!: CheckoutMode;

  /** What the session's branch was created from. Never checked out itself. */
  @Column({ type: 'varchar' })
  baseBranch!: string;

  /** Always `oppenheimer/<project.slug>/<work_session.slug>`. */
  @Column({ type: 'varchar' })
  branch!: string;

  @TimestampColumn({ nullable: true })
  worktreeCreatedAt!: Date | null;

  @TimestampColumn({ nullable: true })
  pushedAt!: Date | null;

  /** Retires the checkout. Rows are never hard-deleted. */
  @TimestampColumn({ nullable: true })
  removedAt!: Date | null;

  @CreatedAtColumn()
  createdAt!: Date;
}
