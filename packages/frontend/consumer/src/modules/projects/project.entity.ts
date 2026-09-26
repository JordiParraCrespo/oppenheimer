import type { CodingAgentId } from '@oppenheimer/shared/agents';

/**
 * One repository a project holds: whether every new session clones it, and
 * what those sessions branch from (`null` is the repository's own default
 * branch, read live).
 */
export interface ProjectRepository {
  id: string;
  installationId: string;
  githubRepoId: number;
  fullName: string;
  isDefault: boolean;
  baseBranch: string | null;
}

/**
 * A project: the body of work a session belongs to, and what New session is
 * prefilled with when it is picked (`product/versions/mvp/12-projects-on-the-console.md`).
 *
 * `slug` is the directory name on every host that holds the project and never
 * changes; `name` is free. A project with an `originGithubRepoId` was made by
 * a repository's first session; one without was made in the dialog.
 */
export class ProjectEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly slug: string,
    public readonly originGithubRepoId: string | null,
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

  /** Whether the project holds this repository — what the move dialog asks. */
  includesRepository(githubRepoId: number): boolean {
    return this.repositories.some((repository) => repository.githubRepoId === githubRepoId);
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
  /** Absent is the repository's own default branch. */
  baseBranch?: string;
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
