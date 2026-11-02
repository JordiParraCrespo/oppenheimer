import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import type { GithubTokenKind } from '@oppenheimer/shared';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/** One repository a token opens, as GitHub listed it when the token was last checked. */
export interface GithubTokenRepositoryRecord {
  githubRepoId: number;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  archived: boolean;
}

/**
 * A GitHub token a person added for repositories the App will never be
 * installed on (`product/next-steps/0.2-pull-requests.md` §6.2). The secret is
 * sealed with AES-256-GCM under `GITHUB_USER_TOKEN_KEY`; `repositories` is
 * what it opened at `checkedAt`, read and replaced whole.
 */
@Entity('github_token')
@Unique('UQ_github_token_user_label', ['userId', 'label'])
@Unique('UQ_github_token_user_id', ['userId', 'id'])
@Check('CHK_github_token_label', `char_length("label") > 0`)
@Check('CHK_github_token_kind', `"kind" IN ('fine_grained', 'classic', 'other')`)
@Check('CHK_github_token_repositories', `jsonb_typeof("repositories") = 'array'`)
@Index('IDX_github_token_user_created', ['userId', 'createdAt'])
export class GithubTokenOrmEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_github_token' })
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 80 })
  label!: string;

  @Column({ type: 'varchar', length: 16 })
  kind!: GithubTokenKind;

  /** GitHub's own id. A bigint, which the driver exchanges as a string. */
  @Column({ type: 'bigint' })
  githubUserId!: string;

  @Column({ type: 'varchar', length: 100 })
  login!: string;

  @Column({ type: 'bytea' })
  tokenSealed!: Buffer;

  /** A classic token's scopes, as GitHub's `x-oauth-scopes` lists them; null for the others. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  scopes!: string | null;

  /** Null for a token GitHub says never expires. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  repositories!: GithubTokenRepositoryRecord[];

  @Column({ type: TIMESTAMP_COLUMN_TYPE })
  checkedAt!: Date;

  /** When GitHub last answered this token `401`; null while it is accepted. */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  refusedAt!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
