import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import type { SessionShareAccess, SessionShareAudience } from '@oppenheimer/shared';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * How one session is shared. One row per session at most
 * (`UQ_session_share_session`); a guest's request finds it by its address
 * (`UQ_session_share_slug`).
 *
 * `(organizationId, sessionId) → work_session(organizationId, id)` is
 * composite, so a share cannot name another workspace's session, and
 * cascades: a session's erasure takes its share. Stopping a share deletes the
 * row, so the next share of the session gets a new address.
 */
@Entity('session_share')
@Check('CHK_session_share_access', `access IN ('read', 'write')`)
@Check('CHK_session_share_audience', `audience IN ('people', 'link')`)
@Check('CHK_session_share_people', `(audience = 'people') = (cardinality(people) > 0)`)
@Check('CHK_session_share_link_reads', `audience = 'people' OR access = 'read'`)
@Check(
  'CHK_session_share_write_expires',
  `access = 'read' OR ("expiresAt" IS NOT NULL AND "expiresAt" <= "updatedAt" + interval '24 hours 1 minute')`,
)
@Index('UQ_session_share_session', ['organizationId', 'sessionId'], { unique: true })
@Index('IDX_session_share_shared_by', ['sharedByUserId'])
export class SessionShareOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  sessionId!: string;

  @Column({ type: 'uuid' })
  sharedByUserId!: string;

  @Index('UQ_session_share_slug', { unique: true })
  @Column({ type: 'varchar', length: 22 })
  slug!: string;

  @Column({ type: 'varchar', length: 8 })
  audience!: SessionShareAudience;

  @Column({ type: 'varchar', length: 8 })
  access!: SessionShareAccess;

  /** Lowercased emails; empty unless the audience is `people`. */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  people!: string[];

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
