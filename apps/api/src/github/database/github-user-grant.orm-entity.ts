import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * A person's GitHub user token, from the user authorization the App's install
 * flow already runs (`product/next-steps/0.2-pull-requests-api-plan.md` §3): what
 * lets the Pull requests area comment, review and merge in their name. One per
 * person, not per workspace — it is their GitHub identity, and every workspace
 * they are in reaches GitHub through its own installation anyway.
 *
 * Both tokens are sealed with AES-256-GCM under `GITHUB_USER_TOKEN_KEY`. With
 * expiring user tokens the access token lasts eight hours and the refresh token
 * six months; without them GitHub hands over one token with neither expiry.
 */
@Entity('github_user_grant')
export class GithubUserGrantOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  /** GitHub's own id. A bigint, which the driver exchanges as a string. */
  @Column({ type: 'bigint' })
  githubUserId!: string;

  @Column({ type: 'varchar', length: 100 })
  login!: string;

  @Column({ type: 'bytea' })
  accessTokenSealed!: Buffer;

  @Column({ type: 'timestamptz', nullable: true })
  accessExpiresAt!: Date | null;

  @Column({ type: 'bytea', nullable: true })
  refreshTokenSealed!: Buffer | null;

  @Column({ type: 'timestamptz', nullable: true })
  refreshExpiresAt!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
