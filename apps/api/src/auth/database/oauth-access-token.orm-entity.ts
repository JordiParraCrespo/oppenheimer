import { CreatedAtColumn, TimestampColumn, UpdatedAtColumn } from '@oppenheimer/backend-ddd';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Maps the Better Auth `oauthAccessToken` table (MCP / OIDC provider plugin).
 * `scopes` holds the space-separated grant an MCP client consented to, which
 * the API turns into a scope context on every request.
 */
@Entity('oauthAccessToken')
export class OAuthAccessTokenOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  accessToken!: string | null;

  @Column({ type: 'varchar', nullable: true })
  refreshToken!: string | null;

  @TimestampColumn({ nullable: true })
  accessTokenExpiresAt!: Date | null;

  @TimestampColumn({ nullable: true })
  refreshTokenExpiresAt!: Date | null;

  @Index()
  @Column({ type: 'varchar' })
  clientId!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'text' })
  scopes!: string;

  @CreatedAtColumn()
  createdAt!: Date;

  @UpdatedAtColumn()
  updatedAt!: Date;
}
