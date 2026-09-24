import { CreatedAtColumn, TimestampColumn, UpdatedAtColumn } from '@oppenheimer/backend-ddd';
import { Column, Entity, PrimaryColumn } from 'typeorm';

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

  @TimestampColumn({ nullable: true })
  accessTokenExpiresAt!: Date | null;

  @TimestampColumn({ nullable: true })
  refreshTokenExpiresAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  scope!: string | null;

  @Column({ type: 'varchar', nullable: true })
  password!: string | null;

  @CreatedAtColumn()
  createdAt!: Date;

  @UpdatedAtColumn()
  updatedAt!: Date;
}
