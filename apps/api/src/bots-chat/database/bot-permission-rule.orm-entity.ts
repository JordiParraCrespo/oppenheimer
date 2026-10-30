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
 * A plain-language rule a reviewer reads before a bot's asking call
 * (`1791004700000-AddBotPermissions`). Capped per bot by the API.
 */
@Entity('bot_permission_rule')
@Index('IDX_bot_permission_rule_bot', ['organizationId', 'botId', 'createdAt', 'id'])
@Index('IDX_bot_permission_rule_created_by', ['createdByUserId'], {
  where: `"createdByUserId" IS NOT NULL`,
})
@Check('CHK_bot_permission_rule_effect', `"effect" IN ('allow', 'ask')`)
@Check('CHK_bot_permission_rule_text', `char_length("text") > 0`)
export class BotPermissionRuleOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  botId!: string;

  @Column({ type: 'varchar', length: 8 })
  effect!: string;

  @Column({ type: 'varchar', length: 280 })
  text!: string;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
