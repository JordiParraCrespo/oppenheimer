/** Whether the App can see every repository on the account, or a chosen few. */
export type RepositorySelection = 'all' | 'selected';

/** Whether the App is installed on a person's account or an organization's. */
export type InstallationAccountType = 'User' | 'Organization';

/**
 * A GitHub App installation, as the console needs it: the account the
 * Oppenheimer App was installed on and what it may read there
 * (`product/versions/mvp/03-control-plane.md`).
 *
 * `id` is the control plane's own; `githubInstallationId` is GitHub's, and is
 * only ever used on the connect call. Everything else addresses the row by
 * `id`, which is why both are carried rather than collapsed into one.
 */
export class InstallationEntity {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly githubInstallationId: number,
    /** The account the App is installed on: `acme-labs`. */
    public readonly accountLogin: string,
    public readonly accountType: InstallationAccountType,
    public readonly repositorySelection: RepositorySelection,
    public readonly createdAt: Date,
  ) {}

  /** Whether the App was given the whole account rather than a chosen list. */
  get coversEveryRepository(): boolean {
    return this.repositorySelection === 'all';
  }
}

/** A repository the installation can reach, for the picker and the summary. */
export class RepositoryEntity {
  constructor(
    public readonly githubRepoId: number,
    public readonly name: string,
    public readonly fullName: string,
    public readonly defaultBranch: string,
    public readonly isPrivate: boolean,
    /** Archived on GitHub: readable, but pushes are refused. */
    public readonly archived: boolean,
    public readonly pushedAt: Date | null,
  ) {}
}
