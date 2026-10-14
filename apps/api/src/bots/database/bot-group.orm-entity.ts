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
 * A heading in the Employees sidebar. `UQ_bot_group_name` is unique on
 * `lower("name")` in the workspace, an expression TypeORM cannot declare.
 */
@Entity('bot_group')
@Unique('UQ_bot_group_organization_id', ['organizationId', 'id'])
@Index('UQ_bot_group_name', { synchronize: false })
@Index('IDX_bot_group_position_order', ['organizationId', 'position'])
@Check('CHK_bot_group_name', `char_length(btrim("name")) > 0`)
@Check('CHK_bot_group_position', `"position" >= 0`)
export class BotGroupOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'varchar', length: 60 })
  name!: string;

  @Column({ type: 'integer', default: 0 })
  position!: number;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
