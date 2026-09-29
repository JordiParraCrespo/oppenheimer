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
 * A project: a saved scope a person creates — the repositories its sessions
 * usually work on and the defaults a new session is offered
 * (`product/versions/mvp/10-api-modules-and-data-model.md`). Each workspace also
 * has one Unassigned project, where a session that names none is listed.
 *
 * `UQ_project_organization_slug` keeps a project's slug unique in its workspace
 * for ever: a slug is the project's stable handle and is never reissued, so an
 * archived project keeps it. A project is metadata only; nothing on a host is
 * named after it.
 */
@Entity('project')
@Index(['organizationId'])
@Index('IDX_project_default_host', ['defaultHostId'])
@Index('UQ_project_organization_unassigned', ['organizationId'], {
  unique: true,
  where: '"isUnassigned"',
})
@Unique('UQ_project_organization_slug', ['organizationId', 'slug'])
export class ProjectOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  /** Lower-case kebab, derived from the name once and never changed or reissued. */
  @Column({ type: 'varchar' })
  slug!: string;

  /**
   * When the project was retired. Archiving refuses while sessions nobody has
   * closed are listed in it; the listing leaves archived rows out.
   */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  archivedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  /**
   * The host a new session is offered. A suggestion, never a grant: creating a
   * session still loads the host through the caller's own-or-grant scope.
   */
  @Column({ type: 'uuid', nullable: true })
  defaultHostId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  defaultAgent!: string | null;

  /**
   * The workspace's Unassigned project: where a session lands when it names
   * none. One per workspace; it cannot be renamed or archived.
   */
  @Column({ type: 'boolean', default: false })
  isUnassigned!: boolean;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
