import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { CheckoutMode } from '../domain/session-checkout.entity';

/**
 * One repository, checked out for one session, and the only place a repository is
 * remembered: there is no repository table.
 *
 * Its composite foreign keys, `(organizationId, sessionId) → work_session
 * (organizationId, id)` and `(organizationId, installationId) → github_installation
 * (organizationId, id)`, make a checkout through another workspace's installation
 * **unrepresentable**, not merely unchecked. Whether `githubRepoId` is inside that
 * installation is GitHub's to say, at every token mint.
 *
 * `(sessionId, githubRepoId) WHERE removedAt IS NULL` lets a repository be re-added
 * after removal; `(sessionId, directoryName)` is unconditional, because a directory
 * name is never reissued (`checkoutDirectoryCandidates`).
 */
@Entity('session_checkout')
@Index('IDX_session_checkout_installation', ['organizationId', 'installationId'])
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

  @Column({ type: 'varchar', default: 'worktree' })
  mode!: CheckoutMode;

  /** What the session's branch was created from. Never checked out itself. */
  @Column({ type: 'varchar' })
  baseBranch!: string;

  /**
   * `oppenheimer/<work_session.slug>`; a session created before that rule keeps
   * the `oppenheimer/<project>/<session>` it recorded.
   */
  @Column({ type: 'varchar' })
  branch!: string;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  worktreeCreatedAt!: Date | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  pushedAt!: Date | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  removedAt!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;
}
