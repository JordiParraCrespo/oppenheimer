import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Persistence model for `host_pairing_token` — the registration token, which is
 * a row because F5 wants it revocable, expiring and traceable to a source
 * address, and none of the three is possible without persistence.
 *
 * Only the digest of the secret is stored. `tokenHash` is unique and is the
 * lookup key of the one statement that spends a token.
 */
@Entity('host_pairing_token')
@Index(['createdByUserId'])
export class HostPairingTokenOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid' })
  createdByUserId!: string;

  /** The name the host adopts when it registers with this token. */
  @Column({ type: 'varchar', length: 80 })
  intendedName!: string;

  /** Non-secret display prefix, e.g. `opr_reg_a1b2c3`. */
  @Column({ type: 'varchar', length: 32 })
  prefix!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  tokenHash!: string;

  /**
   * F5's "source IP shown" is two columns, not one: where the token was minted
   * and where it was spent are different facts, and a mismatch is the
   * interesting one. `inet` rather than text so Postgres validates them.
   */
  @Column({ type: 'inet', nullable: true })
  createdFromIp!: string | null;

  @Column({ type: 'inet', nullable: true })
  redeemedFromIp!: string | null;

  @Column({ type: 'timestamp with time zone' })
  expiresAt!: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  redeemedAt!: Date | null;

  /** The host this token created, written in the same transaction as the burn. */
  @Column({ type: 'uuid', nullable: true })
  redeemedHostId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
