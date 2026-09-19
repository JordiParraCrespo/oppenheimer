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
 * A body of work, and the name its directory takes on every host.
 *
 * The two unique constraints do different jobs. `(organizationId, slug)` is the
 * directory name: it makes uniqueness a database fact rather than a convention
 * two runner versions could implement differently, and — because rows are never
 * deleted — a permanent tombstone for a retired name. `(organizationId, id)` is
 * redundant for lookups and exists so a session's composite foreign key can
 * reference it, making a session in another workspace's project
 * unrepresentable rather than merely unchecked.
 */
@Entity('project')
@Index(['organizationId'])
@Index(['organizationId', 'originGithubRepoId'])
@Unique('UQ_project_organization_slug', ['organizationId', 'slug'])
@Unique('UQ_project_organization_id', ['organizationId', 'id'])
export class ProjectOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  /** Lower-case kebab, immutable, and a directory name — never re-derived. */
  @Column({ type: 'varchar' })
  slug!: string;

  /**
   * The GitHub repository whose first session created this project. The next
   * session on that repository finds the project by this id rather than by
   * re-deriving a string. A bigint column, which the driver exchanges as a
   * string.
   */
  @Column({ type: 'bigint', nullable: true })
  originGithubRepoId!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  archivedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
