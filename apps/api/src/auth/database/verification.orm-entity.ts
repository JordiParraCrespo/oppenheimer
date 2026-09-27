import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Maps the Better Auth `verification` table (email verification + password
 * reset tokens). Owned by Better Auth; declared here so TypeORM creates the
 * table. Better Auth deletes expired rows itself on every lookup, which
 * `IDX_verification_expiresAt` serves.
 */
@Entity('verification')
@Index('IDX_verification_identifier_createdAt', ['identifier', 'createdAt'])
@Index('IDX_verification_expiresAt', ['expiresAt'])
export class Verification {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_verification' })
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
