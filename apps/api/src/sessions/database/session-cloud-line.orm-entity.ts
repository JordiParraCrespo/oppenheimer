import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Check, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * One line of a Claude Code cloud session's transcript, as its hook sent it
 * or the browser extension read it from claude.ai.
 * See `1794038667199-AddCloudSessionChat` for why it is shaped this way.
 * Append-only.
 */
@Entity('session_cloud_line')
@Check('CHK_session_cloud_line_seq', `"seq" >= 0`)
@Index('IDX_session_cloud_line_tenant', ['organizationId', 'sessionId'])
@Index('UQ_session_cloud_line_event', ['sessionId', 'eventId'], {
  unique: true,
  where: `"eventId" IS NOT NULL`,
})
export class SessionCloudLineOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  sessionId!: string;

  /**
   * Its place in the transcript, from 0: the order the hook sent it in, or for
   * a line the extension read, its event's place in the claude.ai log
   * (`1795869094871-NumberCloudLinesByLogPosition`).
   */
  @PrimaryColumn({ type: 'integer' })
  seq!: number;

  @Column({ type: 'uuid' })
  organizationId!: string;

  /**
   * The id claude.ai gives the event this line is, for a line the browser
   * extension read from the session's event log; null for one the session's
   * hook sent. A session holds one kind or the other: the extension's first
   * batch replaces the hook's lines.
   */
  @Column({ type: 'varchar', length: 128, nullable: true })
  eventId!: string | null;

  /** The line as Claude Code wrote it: JSON text, never parsed here. */
  @Column({ type: 'text' })
  line!: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;
}
