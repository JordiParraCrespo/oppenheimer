import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Maps the Better Auth `account` table (credential + OAuth provider links).
 * Owned by Better Auth; declared here so TypeORM creates/migrates the table.
 */
@Entity('account')
export class Account {
  @PrimaryColumn({ type: 'uuid' })
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
