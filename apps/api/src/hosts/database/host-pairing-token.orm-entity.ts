import { CreatedAtColumn, TimestampColumn, UpdatedAtColumn } from '@oppenheimer/backend-ddd';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Persistence model for `host_pairing_token` — the registration token, which is
 * a row because F5 wants it revocable, expiring and traceable to a source
 * address, and none of the three is possible without persistence.
 *
 * Only the digest of the secret is stored. `tokenHash` is unique and is the
 * lookup key of the one statement that spends a token.
 */
@Entity('host_pairing_token')
@Index(['ownerUserId'])
export class HostPairingTokenOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  /**
   * The person the token belongs to — the same column name the host it redeems
   * into carries, because it is the same person and the same scope rule.
   */
  @Column({ type: 'uuid' })
  ownerUserId!: string;

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

  @TimestampColumn()
  expiresAt!: Date;

  @TimestampColumn({ nullable: true })
  revokedAt!: Date | null;

  @TimestampColumn({ nullable: true })
  redeemedAt!: Date | null;

  /** The host this token created, written in the same transaction as the burn. */
  @Column({ type: 'uuid', nullable: true })
  redeemedHostId!: string | null;

  @CreatedAtColumn()
  createdAt!: Date;

  @UpdatedAtColumn()
  updatedAt!: Date;
}
