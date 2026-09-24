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
 * A body of work, and the name its directory takes on every host.
 *
 * Two uniqueness rules, and they answer different questions.
 * `UQ_project_organization_origin` is the **identity**: one GitHub repository
 * maps to one project, as a database fact rather than as application hope, and
 * it is the conflict target the create statement names. It is partial because a
 * project with no origin is possible and several of them must not collide on
 * `NULL`. `UQ_project_organization_slug` is the **directory name**, which two
 * different repositories can derive alike (`acme/xrp-mobile` and
 * `other/xrp-mobile`), so it is what makes the second of them take the next
 * candidate.
 */
@Entity('project')
@Index(['organizationId'])
@Index('UQ_project_organization_origin', ['organizationId', 'originGithubRepoId'], {
  unique: true,
  where: '"originGithubRepoId" IS NOT NULL',
})
@Unique('UQ_project_organization_slug', ['organizationId', 'slug'])
export class ProjectOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  /** The GitHub repository's name as GitHub spells it. Display only. */
  @Column({ type: 'varchar' })
  name!: string;

  /** Lower-case kebab, immutable, and a directory name — never re-derived. */
  @Column({ type: 'varchar' })
  slug!: string;

  /**
   * The GitHub repository whose first session created this project. Every session
   * after the first finds the project by this id rather than by re-deriving a
   * string. A bigint column, which the driver exchanges as a string — and which
   * the domain keeps as one.
   */
  @Column({ type: 'bigint', nullable: true })
  originGithubRepoId!: string | null;

  /**
   * Reserved for the slice that owns sessions: retiring a project has to be able
   * to refuse while work is still going on inside its directory, which needs
   * sessions to answer. Nothing writes this column yet, and the listing already
   * excludes rows that carry it.
   */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  archivedAt!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
