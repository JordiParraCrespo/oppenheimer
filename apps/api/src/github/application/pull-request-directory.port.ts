import type { AccessScope } from '../../authz/domain/access-scope.types';
import type { WorkspaceRepository } from './pull-request-access.port';

/**
 * Which repositories the Pull requests area may read for the caller, and who
 * the caller is on GitHub: what the queue and the figures sort by.
 */
export interface PullRequestDirectoryPort {
  /** Every repository the workspace's usable installations cover, then the ones only the caller's tokens open. */
  repositories(scope: AccessScope): Promise<WorkspaceRepository[]>;
  /** The caller's GitHub login: their stored grant's, or the account of a personal installation they connected. */
  viewerLogin(scope: AccessScope): Promise<string | null>;
}
