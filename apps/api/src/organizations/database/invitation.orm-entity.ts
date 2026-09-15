import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Persistence model for the Better Auth `invitation` table — a pending
 * invitation to join an organization (optionally scoped to a team/workspace).
 * Owned by Better Auth.
 */
@Entity('invitation')
@Index(['organizationId'])
@Index(['email'])
export class InvitationOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'varchar' })
  email!: string;

  @Column({ type: 'varchar', nullable: true })
  role!: string | null;

  @Column({ type: 'varchar', default: 'pending' })
  status!: string;

  @Column({ type: 'uuid', nullable: true })
  teamId!: string | null;

  @Column({ type: 'uuid' })
  inviterId!: string;

  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
