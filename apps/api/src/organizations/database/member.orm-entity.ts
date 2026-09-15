import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Persistence model for the Better Auth `member` table — the user ↔ organization
 * membership with the member's organization role (`owner` / `admin` / `member`
 * by default). Owned by Better Auth.
 */
@Entity('member')
@Index(['userId'])
@Index(['organizationId'])
export class MemberOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', default: 'member' })
  role!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
