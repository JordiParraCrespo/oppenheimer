import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * What a person wrote about themselves for their bots, one row per member of
 * a workspace: in the system prompt of every bot they made there.
 */
@Entity('person_memory')
@Index('IDX_person_memory_user', ['userId'])
@Check('CHK_person_memory_about', `char_length("about") <= 4000`)
export class PersonMemoryOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  organizationId!: string;

  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'text', default: '' })
  about!: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
