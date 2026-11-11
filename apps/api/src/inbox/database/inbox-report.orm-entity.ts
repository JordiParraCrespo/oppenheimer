import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import {
  INBOX_REPORT_LINK_MAX,
  INBOX_REPORT_SOURCE_MAX,
  INBOX_REPORT_TITLE_MAX,
} from '@oppenheimer/shared';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { StoredInboxReportImage } from '../domain/inbox-report.entity';

/** A report sent to a workspace's Inbox (`1794256220000-AddInboxReports`). */
@Entity('inbox_report')
@Index('IDX_inbox_report_org_status_created', ['organizationId', 'status', 'createdAt'])
@Index('IDX_inbox_report_created_by', ['createdByUserId'], {
  where: '"createdByUserId" IS NOT NULL',
})
@Index('IDX_inbox_report_answered_by', ['answeredByUserId'], {
  where: '"answeredByUserId" IS NOT NULL',
})
@Check('CHK_inbox_report_status', `"status" IN ('open', 'answered')`)
@Check('CHK_inbox_report_title', `char_length("title") > 0`)
@Check('CHK_inbox_report_body', `char_length("body") <= 4000`)
@Check('CHK_inbox_report_link', `"link" IS NULL OR char_length("link") > 0`)
@Check(
  'CHK_inbox_report_images',
  `jsonb_typeof("images") = 'array' AND jsonb_array_length("images") <= 4`,
)
@Check(
  'CHK_inbox_report_answer',
  `("status" = 'answered') = ("answer" IS NOT NULL) AND ("status" = 'answered') = ("answeredAt" IS NOT NULL) AND ("answer" IS NULL OR char_length("answer") BETWEEN 1 AND 2000) AND ("answeredAt" IS NULL OR isfinite("answeredAt"))`,
)
export class InboxReportOrmEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_inbox_report' })
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  /** Whose credential sent it; null once that account is gone. */
  @Column({ type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @Column({ type: 'varchar', length: INBOX_REPORT_TITLE_MAX })
  title!: string;

  @Column({ type: 'text', default: '' })
  body!: string;

  @Column({ type: 'varchar', length: INBOX_REPORT_SOURCE_MAX, default: '' })
  source!: string;

  @Column({ type: 'varchar', length: INBOX_REPORT_LINK_MAX, nullable: true })
  link!: string | null;

  /** The report's pictures, read whole with it; their bytes are in storage. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  images!: StoredInboxReportImage[];

  @Column({ type: 'varchar', length: 16, default: 'open' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  answer!: string | null;

  @Column({ type: 'uuid', nullable: true })
  answeredByUserId!: string | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  answeredAt!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
