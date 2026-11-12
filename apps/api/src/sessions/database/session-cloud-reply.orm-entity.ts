import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import type { CloudReplyDelivery } from '@oppenheimer/shared';
import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * What a person typed in a Claude Code cloud session's chat, waiting for the
 * session's Stop hook to collect it, or a host to send it. See
 * `1794038667199-AddCloudSessionChat` and `1794434814591-AddCloudReplyDelivery`.
 */
@Entity('session_cloud_reply')
@Check('CHK_session_cloud_reply_text', `char_length("text") > 0`)
@Check('CHK_session_cloud_reply_delivered_via', `"deliveredVia" IN ('hook', 'host')`)
@Check('CHK_session_cloud_reply_delivered', `("deliveredVia" IS NULL) = ("collectedAt" IS NULL)`)
@Index('IDX_session_cloud_reply_session', ['organizationId', 'sessionId', 'createdAt', 'id'])
@Index('IDX_session_cloud_reply_waiting', ['sessionId', 'createdAt'], {
  where: '"collectedAt" IS NULL',
})
@Index('IDX_session_cloud_reply_author', ['authorId'], { where: '"authorId" IS NOT NULL' })
export class SessionCloudReplyOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  sessionId!: string;

  /** Who wrote it; null once their account is gone. */
  @Column({ type: 'uuid', nullable: true })
  authorId!: string | null;

  @Column({ type: 'text' })
  text!: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  /** When it reached the agent, by either way; null while it waits. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  collectedAt!: Date | null;

  /**
   * `hook`, the session's Stop hook took it; `host`, a host sent it with
   * `claude -p … --cloud <id>`. Null exactly while it waits.
   */
  @Column({ type: 'varchar', length: 8, nullable: true })
  deliveredVia!: CloudReplyDelivery | null;
}
