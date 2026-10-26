import type { GithubTokenKind } from '@oppenheimer/shared';
import type { GithubTokenRepositoryRecord } from './github-token.orm-entity';

/** A person's stored GitHub token, its secret still sealed. */
export interface GithubTokenRecord {
  id: string;
  userId: string;
  label: string;
  kind: GithubTokenKind;
  githubUserId: number;
  login: string;
  tokenSealed: Buffer;
  scopes: string | null;
  expiresAt: Date | null;
  repositories: GithubTokenRepositoryRecord[];
  checkedAt: Date;
  refusedAt: Date | null;
  createdAt: Date;
}

/** What a check of the token against GitHub found. */
export type GithubTokenCheck = Pick<
  GithubTokenRecord,
  'kind' | 'githubUserId' | 'login' | 'scopes' | 'expiresAt' | 'repositories' | 'checkedAt'
>;

export interface GithubTokenPinRecord {
  githubRepoId: number;
  tokenId: string;
}

/**
 * A person's tokens and pins, keyed by person and carrying no tenant: like the
 * user grant, a GitHub credential is the person's. Every read and write names
 * the person, so nobody reaches another's token by its id.
 */
export interface GithubTokenRepositoryPort {
  /** Oldest first. */
  findOwn(userId: string): Promise<GithubTokenRecord[]>;
  findOneOwn(userId: string, id: string): Promise<GithubTokenRecord | null>;
  /** The new token's id, or `label_taken` when the person already has one with that label. */
  insert(
    token: Omit<GithubTokenRecord, 'id' | 'createdAt' | 'refusedAt'>,
  ): Promise<{ id: string } | 'label_taken'>;
  /** False when the person has no such token; `label_taken` when the label is another token's. */
  relabel(userId: string, id: string, label: string): Promise<boolean | 'label_taken'>;
  /** Records a successful check, which also clears a refusal. False when there is no such token. */
  recordCheck(userId: string, id: string, check: GithubTokenCheck): Promise<boolean>;
  /** Marks the token refused by GitHub, so it is not chosen until a check succeeds. */
  recordRefusal(userId: string, id: string, at: Date): Promise<void>;
  /** False when the person has no such token. Its pins go with it. */
  delete(userId: string, id: string): Promise<boolean>;

  findPins(userId: string): Promise<GithubTokenPinRecord[]>;
  /** Replaces the repository's pin, if any. */
  pin(userId: string, pin: GithubTokenPinRecord): Promise<void>;
  /** Idempotent. */
  unpin(userId: string, githubRepoId: number): Promise<void>;
}
