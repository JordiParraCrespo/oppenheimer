import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * One repository a project holds: which one, the base its sessions branch from,
 * and whether it is offered by default (`product/versions/mvp/12-projects.md`).
 *
 * A child of the project aggregate, like `session_checkout` is of the session: it
 * declares no resource, is never queried outside `projects/database/`, and is
 * only ever read by a `projectId` the scoped project read has already verified.
 * The `(organizationId, projectId)` and `(organizationId, installationId)`
 * composite keys in the migration are what make a project holding another
 * workspace's installation unrepresentable.
 *
 * Configuration, not history: a repository taken out of a project is a deleted
 * row. What a session checked out is on its own checkout rows.
 */
@Entity('project_repository')
@Index('IDX_project_repository_organization_repo', ['organizationId', 'githubRepoId'])
@Index('IDX_project_repository_installation', ['organizationId', 'installationId'])
@Unique('UQ_project_repository_project_repo', ['projectId', 'githubRepoId'])
export class ProjectRepositoryOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  projectId!: string;

  /** Our `github_installation` row, not GitHub's number. */
  @Column({ type: 'uuid' })
  installationId!: string;

  /** GitHub's repository id, exchanged as a string because the column is a bigint. */
  @Column({ type: 'bigint' })
  githubRepoId!: string;

  /** `owner/repo` as GitHub spelled it at the last write. Display only. */
  @Column({ type: 'varchar' })
  repositoryFullName!: string;

  @Column({ type: 'varchar' })
  baseBranch!: string;

  @Column({ type: 'boolean' })
  isDefault!: boolean;

  /** The order the person put the repositories in. */
  @Column({ type: 'smallint' })
  position!: number;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
