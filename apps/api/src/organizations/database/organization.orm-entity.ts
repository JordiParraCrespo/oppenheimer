import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Persistence model for the Better Auth `organization` table (organization
 * plugin). Owned by Better Auth — declared here so TypeORM creates/migrates the
 * table and so the app can read organizations for authorization scoping/audit.
 */
@Entity('organization')
export class OrganizationOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', unique: true })
  slug!: string;

  @Column({ type: 'varchar', nullable: true })
  logo!: string | null;

  /** Free-form JSON metadata, stored by Better Auth as a JSON string. */
  @Column({ type: 'text', nullable: true })
  metadata!: string | null;

  /**
   * Bumped in the same transaction as any role or assignment write in this
   * organization. Used as the cache key for the tenant's role rules, so a
   * write invalidates every cached ability without an explicit fan-out.
   */
  @Column({ type: 'int', default: 1 })
  roleVersion!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
