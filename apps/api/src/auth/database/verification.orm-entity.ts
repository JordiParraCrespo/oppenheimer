import { CreatedAtColumn, TimestampColumn, UpdatedAtColumn } from '@oppenheimer/backend-ddd';
import { Column, Entity, PrimaryColumn } from 'typeorm';

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

  @TimestampColumn()
  expiresAt!: Date;

  @CreatedAtColumn()
  createdAt!: Date;

  @UpdatedAtColumn()
  updatedAt!: Date;
}
