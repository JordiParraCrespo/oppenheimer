import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * One repository a person watches in one workspace. A row is a watch and its
 * absence is not: unwatching deletes the row, and the unique key is the
 * identity.
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

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;
}
