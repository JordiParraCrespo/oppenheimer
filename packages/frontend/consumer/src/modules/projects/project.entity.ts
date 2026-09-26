/**
 * One repository a project holds: which one, the base its sessions branch from,
 * and whether a new session is offered it by default.
 */
export interface ProjectRepository {
  installationId: string;
  /** GitHub's repository id. The API sends it as a string; it is a number here, as the picker uses. */
  githubRepoId: number;
  /** `owner/repo` as GitHub spelled it when the project was saved. */
  repositoryFullName: string;
  baseBranch: string;
  isDefault: boolean;
}

/**
 * A project: a saved scope a person creates — the repositories its sessions
 * usually work on and the defaults a new session is offered
 * (`product/versions/mvp/10-api-modules-and-data-model.md`). It is metadata only:
 * a session can be listed under any project and nothing on a host moves.
 */
export class ProjectEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly slug: string,
    public readonly repositories: readonly ProjectRepository[],
    public readonly defaultHostId: string | null,
    public readonly defaultAgent: string | null,
    public readonly instructions: string,
    public readonly createdAt: Date,
  ) {}

  /** The repositories a new session is offered, in the project's order. */
  get defaultRepositories(): readonly ProjectRepository[] {
    return this.repositories.filter((repository) => repository.isDefault);
  }
}

/** What the project dialog saves. The repositories are replaced as a whole set. */
export interface ProjectInput {
  name: string;
  repositories: ProjectRepository[];
  defaultHostId: string | null;
  defaultAgent: string | null;
  instructions: string;
}
