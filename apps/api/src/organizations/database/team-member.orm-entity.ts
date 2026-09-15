import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Persistence model for the Better Auth `teamMember` table — a user's
 * membership of a team (workspace). Owned by Better Auth.
 */
@Entity('teamMember')
@Index(['teamId'])
@Index(['userId'])
export class TeamMemberOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid' })
  teamId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
