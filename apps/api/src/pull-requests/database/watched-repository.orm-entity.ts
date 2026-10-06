import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

/**
 * Whether a person watches one repository in one workspace. A repository
 * nobody has a row for is not watched: a person picks the repositories they
 * want under Watching, so the rows are the choices they made, not a copy of
 * GitHub's list.
 */
@Entity('watched_repository')
@Unique('UQ_watched_repository', ['organizationId', 'userId', 'installationId', 'githubRepoId'])
export class WatchedRepositoryOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  installationId!: string;

  /** GitHub's own id. A bigint, which the driver exchanges as a string. */
  @Column({ type: 'bigint' })
  githubRepoId!: string;

  @Column({ type: 'boolean' })
  watching!: boolean;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
