import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Check, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * A session on a task: started from it or linked to it. Both keys carry the
 * workspace, so a task cannot reach a session of another workspace, and both
 * cascade: a link goes with its task and with its session.
 */
@Entity('task_session')
@Index('IDX_task_session_session', ['organizationId', 'sessionId'])
@Index('IDX_task_session_linked_by', ['linkedByUserId'], { where: '"linkedByUserId" IS NOT NULL' })
@Check('CHK_task_session_origin', `"origin" IN ('started', 'linked')`)
export class TaskSessionOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  organizationId!: string;

  @PrimaryColumn({ type: 'uuid' })
  taskId!: string;

  @PrimaryColumn({ type: 'uuid' })
  sessionId!: string;

  @Column({ type: 'varchar', length: 16 })
  origin!: 'started' | 'linked';

  @Column({ type: 'uuid', nullable: true })
  linkedByUserId!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;
}
