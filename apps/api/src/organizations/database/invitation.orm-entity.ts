import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Persistence model for the Better Auth `invitation` table — a pending
 * invitation to join an organization (optionally scoped to a team/workspace).
 * Owned by Better Auth. Its foreign keys live in the migrations: `organizationId`
 * and `inviterId` cascade from `organization` and `user`, `teamId` is set null
 * when its team goes.
 */
@Entity('invitation')
@Index('IDX_invitation_organizationId', ['organizationId'])
@Index('IDX_invitation_email', ['email'])
@Index('IDX_invitation_inviterId', ['inviterId'])
@Index('IDX_invitation_teamId', ['teamId'], { where: '"teamId" IS NOT NULL' })
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

  @Column({ type: TIMESTAMP_COLUMN_TYPE })
  expiresAt!: Date;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;
}
