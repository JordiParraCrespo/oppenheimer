import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A bot (`1791001500000-AddBots`). `UQ_bot_organization_id` is the target of
 * its documents' and memory's composite keys, which keep them in the bot's
 * workspace.
 */
@Entity('bot')
@Unique('UQ_bot_organization_id', ['organizationId', 'id'])
@Index('IDX_bot_group_position', ['organizationId', 'groupId', 'position'])
@Index('IDX_bot_created_by', ['createdByUserId'], { where: '"createdByUserId" IS NOT NULL' })
@Index('IDX_bot_home_host', ['homeHostId'], { where: '"homeHostId" IS NOT NULL' })
@Check('CHK_bot_name', `char_length(btrim("name")) > 0`)
@Check(
  'CHK_bot_avatar_color',
  `"avatarColor" IN ('mint', 'tangerine', 'snow', 'sky', 'lilac', 'lemon', 'coral', 'moss')`,
)
@Check('CHK_bot_position', `"position" >= 0`)
@Check('CHK_bot_permission', `"permission" IN ('auto', 'full')`)
@Check('CHK_bot_provider', `"provider" IN ('anthropic', 'glm', 'openai')`)
export class BotOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'varchar', length: 280, default: '' })
  description!: string;

  @Column({ type: 'varchar', length: 16, default: 'mint' })
  avatarColor!: string;

  @Column({ type: 'uuid', nullable: true })
  groupId!: string | null;

  @Column({ type: 'integer', default: 0 })
  position!: number;

  @Column({ type: 'uuid', nullable: true })
  homeHostId!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'anthropic' })
  provider!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  model!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  effort!: string | null;

  @Column({ type: 'varchar', length: 8, default: 'auto' })
  permission!: string;

  @Column({ type: 'boolean', default: true })
  learnAutomatically!: boolean;

  /** When its chat last had a message; null until the first. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  lastMessageAt!: Date | null;

  /** The start of that message, for the sidebar's line. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  lastMessagePreview!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
