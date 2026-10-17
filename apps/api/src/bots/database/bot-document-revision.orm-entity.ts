import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/** One saved version of a bot's document. Append-only: no `updatedAt`. */
@Entity('bot_document_revision')
@Unique('UQ_bot_document_revision', ['organizationId', 'botId', 'name', 'revision'])
@Index('IDX_bot_document_revision_author', ['authorUserId'], {
  where: '"authorUserId" IS NOT NULL',
})
@Check('CHK_bot_document_revision_content', `char_length("content") <= 32768`)
@Check('CHK_bot_document_revision_number', `"revision" >= 1`)
@Check('CHK_bot_document_revision_author', `"author" IN ('user', 'bot')`)
@Check('CHK_bot_document_revision_bot_has_no_user', `"author" = 'user' OR "authorUserId" IS NULL`)
@Check(
  'CHK_bot_document_revision_reverted_from',
  `"revertedFrom" IS NULL OR ("revertedFrom" >= 1 AND "revertedFrom" < "revision")`,
)
export class BotDocumentRevisionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  botId!: string;

  @Column({ type: 'varchar', length: 16 })
  name!: string;

  @Column({ type: 'integer' })
  revision!: number;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', length: 8 })
  author!: string;

  @Column({ type: 'uuid', nullable: true })
  authorUserId!: string | null;

  @Column({ type: 'varchar', length: 200, default: '' })
  note!: string;

  @Column({ type: 'integer', nullable: true })
  revertedFrom!: number | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;
}
