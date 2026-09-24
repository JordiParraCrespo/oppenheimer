import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Maps the Better Auth `session` table. Owned by Better Auth; declared here so
 * TypeORM creates/migrates the table alongside the rest of the schema.
 */
@Entity('session')
export class Session {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', unique: true })
  token!: string;

  @Column({ type: TIMESTAMP_COLUMN_TYPE })
  expiresAt!: Date;

  @Column({ type: 'varchar', nullable: true })
  ipAddress!: string | null;

  @Column({ type: 'varchar', nullable: true })
  userAgent!: string | null;

  /**
   * True for the internal sessions `DelegatedSessionAdapter` mints so an API
   * token or OAuth client can reach the Better Auth façades. They are bridges,
   * not devices, so the profile session list leaves them out.
   *
   * Declared to Better Auth as a session `additionalField` in `auth.ts` — it
   * owns every write to this table, and a column it does not know about would
   * be dropped on the way in.
   */
  @Column({ type: 'boolean', default: false })
  delegated!: boolean;

  /** The credential a delegated session was minted for; null for devices. */
  @Column({ type: 'varchar', nullable: true })
  delegatedCredentialId!: string | null;

  // --- Better Auth admin plugin: set while an admin impersonates a user. ---
  @Column({ type: 'uuid', nullable: true })
  impersonatedBy!: string | null;

  // --- Better Auth organization plugin: the session's active org/workspace. ---
  @Column({ type: 'uuid', nullable: true })
  activeOrganizationId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  activeTeamId!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
