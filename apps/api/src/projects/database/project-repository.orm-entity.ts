import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * One repository of a project (`product/versions/mvp/12-projects-on-the-console.md`).
 *
 * `fullName` is a display snapshot, as on a checkout, so a name prints
 * without a GitHub call. `baseBranch` null is the repository's own default
 * branch, read live when a session is created.
 *
 * No relation is declared in either direction: the aggregate's store loads
 * these rows itself, so the two tables' mappings do not import each other.
 */
@Entity('project_repository')
@Index('IDX_project_repository_installation', ['installationId'])
@Unique('UQ_project_repository_project_repo', ['projectId', 'githubRepoId'])
export class ProjectRepositoryOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** The project row; the foreign key and its cascade live in the migration. */
  @Column({ type: 'uuid' })
  projectId!: string;

  @Column({ type: 'uuid' })
  installationId!: string;

  @Column({ type: 'bigint' })
  githubRepoId!: string;

  @Column({ type: 'varchar' })
  fullName!: string;

  @Column({ type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({ type: 'varchar', nullable: true })
  baseBranch!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;
}
