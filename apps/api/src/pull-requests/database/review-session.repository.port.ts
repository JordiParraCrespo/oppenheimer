import type { AccessScope } from '@oppenheimer/backend-authz';

/** The pull request a review session reviews, as it was when it started. */
export interface ReviewSessionLink {
  sessionId: string;
  installationId: string;
  githubRepoId: number;
  number: number;
  repository: string;
  title: string;
  headRef: string;
}

/** A review session with what the For review list and the Chat tab show of its session. */
export interface ReviewSessionRow extends ReviewSessionLink {
  hostId: string;
  /** The session's stored lifecycle (`work_session.state`). */
  state: string;
  createdAt: Date;
}

/** The caller's own review sessions; every read and write is narrowed to the scope's person. */
export interface ReviewSessionRepositoryPort {
  /** Idempotent on the session: a retried start finds its link in place. */
  link(scope: AccessScope, link: ReviewSessionLink): Promise<void>;
  /** The ones not closed, newest first: the 100 newest (`OPEN_LIMIT`), a person's working set. */
  findOpen(scope: AccessScope): Promise<ReviewSessionRow[]>;
}
