import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * The token a person chose to read one repository with, over the narrowest
 * (`product/next-steps/0.2-pull-requests.md` §6.2). Tied to the token by
 * `("userId", "tokenId")`, so it can only name the person's own; gone with it.
 */
@Entity('github_token_pin')
@Index('IDX_github_token_pin_token', ['userId', 'tokenId'])
export class GithubTokenPinOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_github_token_pin' })
  userId!: string;

  /** GitHub's own id. A bigint, which the driver exchanges as a string. */
  @PrimaryColumn({ type: 'bigint', primaryKeyConstraintName: 'PK_github_token_pin' })
  githubRepoId!: string;

  @Column({ type: 'uuid' })
  tokenId!: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;
}
