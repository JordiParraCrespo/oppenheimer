import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * One message a bot sent from a person's Gmail (`product/next-steps/mail.md`
 * §3.4): claimed before Gmail is asked, keyed by the approval it carries out,
 * so a retried job never sends twice; and the record of what went out. The
 * body is never kept.
 */
@Entity('mail_send')
@Index('UQ_mail_send_approval', ['approvalId'], { unique: true })
@Index('IDX_mail_send_connection_created', ['connectionId', 'createdAt'])
@Index('IDX_mail_send_user_created', ['organizationId', 'userId', 'createdAt'])
@Check('CHK_mail_send_status', `"status" IN ('sending', 'sent', 'failed')`)
@Check('CHK_mail_send_kind', `"kind" IN ('new', 'reply', 'reply_all', 'forward', 'draft')`)
export class MailSendOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid', nullable: true })
  connectionId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  botId!: string | null;

  @Column({ type: 'uuid' })
  approvalId!: string;

  @Column({ type: 'varchar', length: 16 })
  kind!: 'new' | 'reply' | 'reply_all' | 'forward' | 'draft';

  @Column({ type: 'varchar', length: 320 })
  accountEmail!: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  recipients!: string[];

  @Column({ type: 'varchar', length: 998 })
  subject!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: 'sending' | 'sent' | 'failed';

  @Column({ type: 'varchar', length: 64, nullable: true })
  gmailMessageId!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  gmailThreadId!: string | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  sentAt!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
