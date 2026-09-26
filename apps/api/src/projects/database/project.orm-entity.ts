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
 * (`product/versions/mvp/10-api-modules-and-data-model.md`).
 *
 * `UQ_project_organization_slug` keeps a project's slug unique in its workspace
 * for ever: a slug is the project's stable handle and is never reissued, so an
 * archived project keeps it. A project is metadata only; nothing on a host is
 * named after it.
 */
@Entity('project')
@Index(['organizationId'])
@Unique('UQ_project_organization_slug', ['organizationId', 'slug'])
export class ProjectOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  /** Display name. Free to change. */
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

  /** Who created the project. Audit only; null once that account is gone. */
  @Column({ type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  /**
   * The host a new session is offered. A suggestion, never a grant: creating a
   * session still loads the host through the caller's own-or-grant scope.
   */
  @Column({ type: 'uuid', nullable: true })
  defaultHostId!: string | null;

  /** The agent a new session is offered, from the closed catalog. */
  @Column({ type: 'varchar', nullable: true })
  defaultAgent!: string | null;

  /** Handed to every new session's agent. Empty is none. */
  @Column({ type: 'text', default: '' })
  instructions!: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
