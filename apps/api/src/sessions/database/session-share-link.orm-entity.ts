import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import type { ShareLinkAccess, ShareLinkAudience } from '@oppenheimer/shared';
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
 * A share link of one session. Only the SHA-256 of its secret is stored, and
 * `tokenHash` is the unique key every holder's request looks it up by.
 *
 * `(organizationId, sessionId) → work_session(organizationId, id)` is composite,
 * so a link cannot name another workspace's session, and cascades: a session's
 * erasure takes its links. A revoked link is kept, for the owner's list.
 */
@Entity('session_share_link')
@Check('CHK_session_share_link_access', `access IN ('read', 'write')`)
@Check('CHK_session_share_link_audience', `audience IN ('anyone', 'accounts', 'people')`)
@Check('CHK_session_share_link_people', `(audience = 'people') = (cardinality(people) > 0)`)
@Check(
  'CHK_session_share_link_open_write_expires',
  `NOT (access = 'write' AND audience = 'anyone') OR ("expiresAt" IS NOT NULL AND "expiresAt" <= "createdAt" + interval '7 days 1 minute')`,
)
@Index('IDX_session_share_link_session', ['organizationId', 'sessionId'])
@Index('IDX_session_share_link_created_by', ['createdByUserId'])
export class SessionShareLinkOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  sessionId!: string;

  @Column({ type: 'uuid' })
  createdByUserId!: string;

  @Index('UQ_session_share_link_token_hash', { unique: true })
  @Column({ type: 'varchar', length: 64 })
  tokenHash!: string;

  @Column({ type: 'varchar', length: 8 })
  access!: ShareLinkAccess;

  @Column({ type: 'varchar', length: 16 })
  audience!: ShareLinkAudience;

  /** Lowercased emails; empty unless the audience is `people`. */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  people!: string[];

  @Column({ type: 'varchar', length: 80, nullable: true })
  label!: string | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  expiresAt!: Date | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
