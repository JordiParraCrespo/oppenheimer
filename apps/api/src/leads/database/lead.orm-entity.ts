import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A sales lead — the worked example for the authorization kernel.
 *
 * The three scope columns (`organizationId`, `teamId`, `ownerId`) are the ones
 * `leads.resource.ts` names, and they are all the kernel needs to filter rows.
 */
@Entity('lead')
@Index(['organizationId'])
@Index(['organizationId', 'teamId'])
export class LeadOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  /** Owning team (workspace). Null for a lead not yet assigned to one. */
  @Column({ type: 'uuid', nullable: true })
  teamId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  ownerId!: string | null;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  email!: string | null;

  /** Deal value in minor units, so no floating point reaches the money. */
  @Column({ type: 'bigint', default: 0 })
  value!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
