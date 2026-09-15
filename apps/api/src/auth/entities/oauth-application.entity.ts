import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Maps the Better Auth `oauthApplication` table (MCP / OIDC provider plugin) —
 * one row per OAuth client, including clients that register themselves through
 * dynamic client registration. Owned by Better Auth; declared here so TypeORM
 * creates and migrates the table alongside the rest of the schema.
 */
@Entity('oauthApplication')
export class OAuthApplicationOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', nullable: true })
  name!: string | null;

  @Column({ type: 'text', nullable: true })
  icon!: string | null;

  @Column({ type: 'text', nullable: true })
  metadata!: string | null;

  @Column({ type: 'varchar', unique: true })
  clientId!: string;

  @Column({ type: 'varchar', nullable: true })
  clientSecret!: string | null;

  @Column({ type: 'text' })
  redirectURLs!: string;

  @Column({ type: 'varchar' })
  type!: string;

  @Column({ type: 'boolean', default: false })
  disabled!: boolean;

  @Column({ type: 'varchar', nullable: true })
  userId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
