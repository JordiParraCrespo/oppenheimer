import { CreatedAtColumn, TimestampColumn } from '@oppenheimer/backend-ddd';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

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

  @CreatedAtColumn()
  createdAt!: Date;

  @TimestampColumn({ nullable: true })
  updatedAt!: Date | null;
}
