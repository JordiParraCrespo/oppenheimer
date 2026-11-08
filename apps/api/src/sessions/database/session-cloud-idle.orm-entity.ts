import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Whether a Claude Code cloud session's Stop hook stopped waiting with no
 * reply: the session is idle, and a reply wakes it from its host. See
 * `1794137373046-AddCloudSessionIdle` for why it is shaped this way.
 */
@Entity('session_cloud_idle')
export class SessionCloudIdleOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  organizationId!: string;

  @PrimaryColumn({ type: 'uuid' })
  sessionId!: string;

  /** When the last hook's wait ended empty; null while working or listening. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  idleSince!: Date | null;

  /** When a reply claimed the session to wake it; null once a hook followed. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  wakingSince!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
