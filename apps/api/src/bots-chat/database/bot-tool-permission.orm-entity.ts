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
 * The owner's setting for one tool of a bot (`1791004700000-AddBotPermissions`):
 * the tool's decision, or a standing grant on one thing (with a subject).
 */
@Entity('bot_tool_permission')
// NULLS NOT DISTINCT, which TypeORM cannot express: the migration's.
@Index('UQ_bot_tool_permission', { synchronize: false })
@Index('IDX_bot_tool_permission_bot', ['organizationId', 'botId'])
@Index('IDX_bot_tool_permission_created_by', ['createdByUserId'], {
  where: `"createdByUserId" IS NOT NULL`,
})
@Check('CHK_bot_tool_permission_decision', `"decision" IN ('allow', 'ask', 'off')`)
@Check('CHK_bot_tool_permission_tool', `char_length("tool") > 0`)
@Check(
  'CHK_bot_tool_permission_subject',
  `num_nonnulls("subjectKind", "subjectKey", "subjectLabel") IN (0, 3)`,
)
@Check('CHK_bot_tool_permission_grant', `"subjectKind" IS NULL OR "decision" = 'allow'`)
export class BotToolPermissionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  botId!: string;

  @Column({ type: 'varchar', length: 64 })
  tool!: string;

  @Column({ type: 'varchar', length: 8 })
  decision!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  subjectKind!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  subjectKey!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  subjectLabel!: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
