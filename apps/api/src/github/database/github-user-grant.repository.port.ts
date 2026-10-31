/** A person's stored GitHub user grant, its tokens still sealed. */
export interface GithubUserGrantRecord {
  userId: string;
  githubUserId: number;
  login: string;
  accessTokenSealed: Buffer;
  accessExpiresAt: Date | null;
  refreshTokenSealed: Buffer | null;
  refreshExpiresAt: Date | null;
}

/**
 * The grants are keyed by person and carry no tenant: a GitHub identity is the
 * person's, like their hosts. Nothing here is reachable from a route; the
 * GitHub module's own resolvers are its only readers.
 */
export interface GithubUserGrantRepositoryPort {
  findByUserId(userId: string): Promise<GithubUserGrantRecord | null>;
  upsert(grant: GithubUserGrantRecord): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
}
