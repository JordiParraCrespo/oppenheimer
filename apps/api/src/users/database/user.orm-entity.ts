import { CreatedAtColumn, TimestampColumn, UpdatedAtColumn } from '@oppenheimer/backend-ddd';
import type { Role } from '@oppenheimer/shared';
import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Persistence model for the Better Auth `user` table. This is infrastructure —
 * the domain `UserEntity` is mapped to/from this record by `UserMapper`.
 *
 * Better Auth owns writes to identity columns (sign-up, OAuth, verification);
 * the application reads/updates the profile columns through TypeORM for the
 * `/users` endpoints. `firstName`, `lastName`, `phone`, `jobTitle`, `role` and
 * `isActive` are Better Auth "additional fields" declared in `auth.ts`.
 */
@Entity('user')
export class UserOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', unique: true })
  email!: string;

  @Column({ type: 'boolean', default: false })
  emailVerified!: boolean;

  @Column({ type: 'varchar', nullable: true })
  image!: string | null;

  @Column({ type: 'varchar' })
  firstName!: string;

  @Column({ type: 'varchar' })
  lastName!: string;

  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', nullable: true })
  jobTitle!: string | null;

  @Column({ type: 'varchar', default: 'user' })
  role!: Role;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  // --- Better Auth admin plugin (super-admin / moderation) ---

  @Column({ type: 'boolean', default: false })
  banned!: boolean;

  @Column({ type: 'varchar', nullable: true })
  banReason!: string | null;

  @TimestampColumn({ nullable: true })
  banExpires!: Date | null;

  @CreatedAtColumn()
  createdAt!: Date;

  @UpdatedAtColumn()
  updatedAt!: Date;
}
