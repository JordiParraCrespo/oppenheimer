import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Maps the Better Auth `verification` table (email verification + password
 * reset tokens). Owned by Better Auth; declared here so TypeORM creates the
 * table.
 */
@Entity('verification')
export class Verification {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar' })
  identifier!: string;

  @Column({ type: 'varchar' })
  value!: string;

  @Column({ type: TIMESTAMP_COLUMN_TYPE })
  expiresAt!: Date;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
