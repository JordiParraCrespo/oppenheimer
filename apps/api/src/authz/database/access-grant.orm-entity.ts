import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { AccessGrantPrincipalType } from '../domain/access-grant.entity';

/**
 * An explicit grant of access to rows a caller would not otherwise reach.
 *
 * This is the generic form of "these specific records, for this person": one
 * table serves every module, so a second scoping axis never means a second
 * half-tested scoping system.
 *
 * `resourceId` deliberately carries **no foreign key** — it is polymorphic and
 * must be able to name a row in any module's table. `resourceId = null` means
 * every row of that type within the organization, which is the strongest thing
 * the table can express and is why `canGrantScope` restricts who may write it.
 */
@Entity('access_grant')
@Index(['organizationId', 'principalType', 'principalId', 'resourceType'])
export class AccessGrantOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'varchar' })
  principalType!: AccessGrantPrincipalType;

  @Column({ type: 'uuid' })
  principalId!: string;

  /** A registry subject, e.g. `Lead`. */
  @Column({ type: 'varchar' })
  resourceType!: string;

  @Column({ type: 'uuid', nullable: true })
  resourceId!: string | null;

  @Column({ type: 'uuid' })
  grantedBy!: string;

  /**
   * Expiry is enforced in the resolver's `WHERE`, not by a cleanup job. A
   * sweeper is welcome for table size, but it must never be the thing that
   * makes expiry correct.
   */
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
