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
 * GitHub through the installation token and a checkout records the ids it took
 * inline (`product/09-github-app-install.md`).
 *
 * `(organizationId, id)` is unique so a checkout in another module can carry a
 * composite foreign key to it and be unable to reference another tenant's
 * installation.
 */
@Entity('github_installation')
@Index(['organizationId'])
@Unique('UQ_github_installation_github_id', ['githubInstallationId'])
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

  /** `User` or `Organization`, as GitHub reports it. */
  @Column({ type: 'varchar' })
  accountType!: string;

  /** `all` or `selected` — which repositories the install dialog granted. */
  @Column({ type: 'varchar' })
  repositorySelection!: string;

  @Column({ type: 'uuid' })
  installedByUserId!: string;

  @Column({ type: 'timestamp', nullable: true })
  suspendedAt!: Date | null;

  /** Disconnected here, or uninstalled on GitHub. Never hard-deleted: the row
   *  is what lets the console say why repositories stopped resolving. */
  @Column({ type: 'timestamp', nullable: true })
  deletedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
