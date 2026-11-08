import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Check, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * One line of a Claude Code cloud session's transcript, as its hook sent it.
 * See `1794038667199-AddCloudSessionChat` for why it is shaped this way.
 * Append-only.
 */
@Entity('session_cloud_line')
@Check('CHK_session_cloud_line_seq', `"seq" >= 0`)
@Index('IDX_session_cloud_line_tenant', ['organizationId', 'sessionId'])
export class SessionCloudLineOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  sessionId!: string;

  /** Its place in the transcript, from 0. */
  @PrimaryColumn({ type: 'integer' })
  seq!: number;

  @Column({ type: 'uuid' })
  organizationId!: string;

  /** The line as Claude Code wrote it: JSON text, never parsed here. */
  @Column({ type: 'text' })
  line!: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;
}
