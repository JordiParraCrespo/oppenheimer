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
 * The only table in `github/`. A repository is never a row: the picker asks
 * GitHub through the installation token, and a repository is remembered only by
 * the checkout that took it (`product/versions/mvp/03-control-plane.md`).
 *
 * `(organizationId, id)` is unique so a checkout in another module can carry a
 * composite foreign key to it and be unable to reference another tenant's
 * installation.
 *
 * **`githubInstallationId` is unique among live rows only**, by
 * `UQ_github_installation_live_github_id` — a partial index on
 * `WHERE "deletedAt" IS NULL`, which is why it is declared in the migration and
 * not here: TypeORM cannot express a predicate on an index, and declaring the
 * unconditional version would have a disconnected row hold the number forever.
 */
@Entity('github_installation')
@Index(['organizationId'])
// Backs FK_github_installation_installed_by.
@Index('IDX_github_installation_installed_by', ['installedByUserId'])
@Unique('UQ_github_installation_organization_id', ['organizationId', 'id'])
export class GithubInstallationOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  /** GitHub's own id. A bigint, which the driver exchanges as a string. */
  @Column({ type: 'bigint' })
  githubInstallationId!: string;

  @Column({ type: 'varchar' })
  accountLogin!: string;

  /** `User` or `Organization`; a check constraint holds the pair. */
  @Column({ type: 'varchar' })
  accountType!: string;

  /** `all` or `selected` — which repositories the install dialog granted. */
  @Column({ type: 'varchar' })
  repositorySelection!: string;

  @Column({ type: 'uuid' })
  installedByUserId!: string;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  suspendedAt!: Date | null;

  /**
   * GitHub's own time of the last suspend or unsuspend this row applied, so a
   * late or replayed delivery cannot undo a newer one. Null until the first.
   * Written only by the webhook's conditional update, never by the mapper.
   */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  statusChangedAt?: Date | null;

  /** Disconnected here, or uninstalled on GitHub. Never hard-deleted: the row
   *  is what lets the console say why repositories stopped resolving. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  deletedAt!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
