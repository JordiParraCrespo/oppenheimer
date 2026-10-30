import type { AccessScope } from '@oppenheimer/backend-authz';
import type { CiFindingEntity } from '../domain/ci-finding.entity';

/** A pull request's head, as its findings are filed: its repository's id, its number and the commit. */
export interface CiFindingHead {
  githubRepoId: number;
  number: number;
  headSha: string;
}

/** What failing checks came to, filed by the workspace's pull request heads. */
export interface CiFindingRepositoryPort {
  /**
   * Files the findings, in one write: each replaces the one already filed
   * for its check on its commit, keeping that row's id.
   */
  record(findings: readonly CiFindingEntity[]): Promise<void>;
  /** A head's findings in the caller's workspace, by check. */
  findForHead(scope: AccessScope, head: CiFindingHead): Promise<CiFindingEntity[]>;
}
