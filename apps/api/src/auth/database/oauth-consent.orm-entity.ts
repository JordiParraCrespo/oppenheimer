import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Maps the Better Auth `oauthConsent` table (MCP / OIDC provider plugin): what
 * a user agreed to grant a given OAuth client on the consent screen. Revoking a
 * connection removes the row, so the client must ask again.
 */
@Entity('oauthConsent')
export class OAuthConsentOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ type: 'varchar' })
  clientId!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  scopes!: string;

  @Column({ type: 'boolean', default: false })
  consentGiven!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
