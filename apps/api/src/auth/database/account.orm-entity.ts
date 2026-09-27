import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Maps the Better Auth `account` table (credential + OAuth provider links).
 * Owned by Better Auth; declared here so TypeORM creates/migrates the table.
 * `userId` references `user` (`FK_account_user`, ON DELETE CASCADE); the
 * foreign key lives in the migration, as for every entity here.
 */
@Entity('account')
@Index('IDX_account_userId', ['userId'])
@Unique('UQ_account_providerId_accountId', ['providerId', 'accountId'])
export class Account {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_account' })
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar' })
  accountId!: string;

  @Column({ type: 'varchar' })
  providerId!: string;

  @Column({ type: 'varchar', nullable: true })
  accessToken!: string | null;

  @Column({ type: 'varchar', nullable: true })
  refreshToken!: string | null;

  @Column({ type: 'varchar', nullable: true })
  idToken!: string | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  accessTokenExpiresAt!: Date | null;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  refreshTokenExpiresAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  scope!: string | null;

  @Column({ type: 'varchar', nullable: true })
  password!: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
