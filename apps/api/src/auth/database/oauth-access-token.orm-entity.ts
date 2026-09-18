import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

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

  @Column({ type: 'timestamp', nullable: true })
  accessTokenExpiresAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  refreshTokenExpiresAt!: Date | null;

  @Index()
  @Column({ type: 'varchar' })
  clientId!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'text' })
  scopes!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
