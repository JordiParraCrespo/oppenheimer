/** A repository the person's tokens open, and the token that reads it now; null when none still works. */
export interface TokenRepository {
  githubRepoId: number;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  tokenId: string | null;
  /** Whether the person pinned the token that reads it. */
  pinned: boolean;
}
