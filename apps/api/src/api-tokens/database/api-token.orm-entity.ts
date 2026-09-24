import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import type { Scope } from '@oppenheimer/shared';
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Persistence model for the application-owned `api_token` table.
 *
 * Only the SHA-256 digest of a token is stored; the secret is shown once at
 * creation and is unrecoverable afterwards. `tokenHash` is unique and indexed
 * because it is the lookup key on every authenticated request.
 */
@Entity('api_token')
export class ApiTokenOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  /** Non-secret display prefix, e.g. `oppenheimer_pat_a1b2c3`. */
  @Column({ type: 'varchar', length: 32 })
  prefix!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  tokenHash!: string;

  /** Granted scopes, e.g. `["users:read","roles:write"]`. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  scopes!: Scope[];

  /** `null` means the token follows the owner's organization memberships. */
  @Column({ type: 'jsonb', nullable: true })
  organizationIds!: string[] | null;

  /** `null` means the token may be used from any source address. */
  @Column({ type: 'jsonb', nullable: true })
  ipAllowlist!: string[] | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  expiresAt!: Date | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  lastUsedAt!: Date | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
