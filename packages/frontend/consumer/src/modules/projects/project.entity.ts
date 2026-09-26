import type { CodingAgentId } from '@oppenheimer/shared/agents';

/**
 * One repository a project holds: whether every new session clones it, and
 * what those sessions branch from.
 */
export interface ProjectRepository {
  id: string;
  installationId: string;
  /** GitHub's id as the API sends it — a string, because the column is a bigint — the same type a checkout holds. */
  githubRepoId: string;
  fullName: string;
  isDefault: boolean;
  baseBranch: string;
}

/**
 * A project: the body of work a session is listed under, and what New session
 * is prefilled with when it is picked
 * (`product/versions/mvp/10-api-modules-and-data-model.md`).
 *
 * It is metadata: a session's directory and branch never name it, so a session
 * moves between projects freely. `slug` is a stable handle that never changes;
 * `name` is free — except the Unassigned project's, the one every workspace has
 * for sessions that name none, which also cannot be deleted.
 */
export class ProjectEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly slug: string,
    public readonly isUnassigned: boolean,
    public readonly defaultHostId: string | null,
    public readonly defaultAgent: CodingAgentId | null,
    public readonly repositories: ProjectRepository[],
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  /** The repositories every new session of the project clones, in the order listed. */
  get defaultRepositories(): ProjectRepository[] {
    return this.repositories.filter((repository) => repository.isDefault);
  }

  /** The repository's own name — the `xrp-mobile` of `acme/xrp-mobile`. */
  get shortName(): string {
    return this.repositories.map((repository) => shortName(repository.fullName)).join(', ');
  }
}

/** The `xrp-mobile` of `acme/xrp-mobile`. */
export function shortName(fullName: string): string {
  return fullName.split('/').pop() ?? fullName;
}

/** What the project dialog sends: one row per repository it ticked. */
export interface ProjectRepositoryInput {
  installationId: string;
  githubRepoId: number;
  isDefault: boolean;
  /** What sessions branch from; the repository's own default when nobody picked another. */
  baseBranch: string;
}

export interface CreateProjectInput {
  name: string;
  repositories: ProjectRepositoryInput[];
  defaultHostId?: string | null;
  defaultAgent?: CodingAgentId | null;
}

/** Every field optional: only the given ones change, `null` clears a default. */
export interface UpdateProjectInput {
  name?: string;
  repositories?: ProjectRepositoryInput[];
  defaultHostId?: string | null;
  defaultAgent?: CodingAgentId | null;
}
