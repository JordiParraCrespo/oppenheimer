import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { HostCapabilities } from '../domain/host.entity';

/**
 * **No `organizationId`.** A host belongs to the person who paired it, the way
 * Better Auth's own device-and-login tables (`session`, `account`) hang off
 * `user`; what *runs* on a host is scoped by the session's workspace instead.
 * Why the key is a column here is on `HostEntity`.
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

  @Column({ type: 'jsonb', nullable: true })
  capabilities!: HostCapabilities | null;

  /** Base64 of the raw Ed25519 public key. */
  @Column({ type: 'text' })
  publicKey!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  publicKeyFingerprint!: string;

  /**
   * Null from registration on: presence lives in `host_presence.lastSeenAt`,
   * which the mapper reads instead whenever the host has a presence row.
   */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  lastSeenAt!: Date | null;

  /** Set when the host is unpaired. Rows are never hard-deleted. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  unpairedAt!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
