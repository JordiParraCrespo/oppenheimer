import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Maps the Better Auth `session` table. Owned by Better Auth; declared here so
 * TypeORM creates/migrates the table alongside the rest of the schema.
 * Foreign keys live in the migrations (`InitialSchema`), as for every entity
 * here: `userId` and `impersonatedBy` reference `user` (ON DELETE CASCADE);
 * `activeOrganizationId` and `activeTeamId` reference `organization` and
 * `team` (ON DELETE SET NULL).
 */
@Entity('session')
@Unique('UQ_session_token', ['token'])
@Index('IDX_session_userId', ['userId'])
@Index('IDX_session_impersonatedBy', ['impersonatedBy'], { where: '"impersonatedBy" IS NOT NULL' })
@Index('IDX_session_activeOrganizationId', ['activeOrganizationId'], {
  where: '"activeOrganizationId" IS NOT NULL',
})
@Index('IDX_session_activeTeamId', ['activeTeamId'], { where: '"activeTeamId" IS NOT NULL' })
export class Session {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_session' })
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar' })
  token!: string;

  @Column({ type: TIMESTAMP_COLUMN_TYPE })
  expiresAt!: Date;

  @Column({ type: 'varchar', nullable: true })
  ipAddress!: string | null;

  @Column({ type: 'varchar', nullable: true })
  userAgent!: string | null;

  /**
   * True for the internal sessions `DelegatedSessionAdapter` mints so an API
   * token or OAuth client can reach the Better Auth façades.
   *
   * Declared to Better Auth as a session `additionalField` in `better-auth.config.ts` — it
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
