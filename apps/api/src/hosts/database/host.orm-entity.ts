import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { HostCapabilities } from '../domain/host.entity';

/**
 * Persistence model for `host`.
 *
 * **No `organizationId`.** A host belongs to the person who paired it, the way
 * Better Auth's own device-and-login tables (`session`, `account`) hang off
 * `user`; what *runs* on a host is scoped by the session's workspace instead.
 *
 * The key sits on this row rather than in a `host_key` table: the boot lookup
 * for an assertion is the hottest read in the system, and when rotation arrives
 * on the link the retired key is one more column beside it — two keys, never N.
 */
@Entity('host')
@Index(['ownerUserId'])
export class HostOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid' })
  ownerUserId!: string;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  hostname!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  os!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  arch!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  runnerVersion!: string | null;

  /** The inventory the runner last reported: tools, agents, disk. */
  @Column({ type: 'jsonb', nullable: true })
  capabilities!: HostCapabilities | null;

  /** Base64 of the raw Ed25519 public key. */
  @Column({ type: 'text' })
  publicKey!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  publicKeyFingerprint!: string;

  /** Last heartbeat. `online` is derived from it in the read query. */
  @Column({ type: 'timestamp with time zone', nullable: true })
  lastSeenAt!: Date | null;

  /** Set when the host is unpaired. Rows are never hard-deleted. */
  @Column({ type: 'timestamp with time zone', nullable: true })
  unpairedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
