import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Check, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Which pull request a review session reviews. The session is the key and the
 * row goes with it; the title and repository name are copied when it starts,
 * so the For review list needs no read of GitHub per row.
 */
@Entity('pull_request_review_session')
@Check('CHK_pull_request_review_session_number', 'number > 0')
@Index('IDX_pull_request_review_session_owner', ['organizationId', 'userId', 'createdAt'])
@Index('IDX_pull_request_review_session_session', ['organizationId', 'sessionId'])
@Index('IDX_pull_request_review_session_user', ['userId'])
@Index('IDX_pull_request_review_session_installation', ['installationId'])
export class ReviewSessionOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  sessionId!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  installationId!: string;

  /** GitHub's own id. A bigint, which the driver exchanges as a string. */
  @Column({ type: 'bigint' })
  githubRepoId!: string;

  @Column({ type: 'integer' })
  number!: number;

  /** `owner/name`, as it was when the session started. */
  @Column({ type: 'varchar', length: 200 })
  repository!: string;

  @Column({ type: 'varchar', length: 1024 })
  title!: string;

  @Column({ type: 'varchar', length: 255 })
  headRef!: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;
}
