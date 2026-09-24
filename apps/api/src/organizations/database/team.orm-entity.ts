import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Persistence model for the Better Auth `team` table. Teams are how the app
 * models **workspaces** inside an organization. Owned by Better Auth.
 */
@Entity('team')
@Index(['organizationId'])
export class TeamOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  updatedAt!: Date | null;
}
