import { randomUUID } from 'node:crypto';
import {
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
  Entity,
} from '@oppenheimer/backend-ddd';

export interface ProjectRepositoryProps {
  /** Our `github_installation` row, the one tokens for this repository are minted through. */
  installationId: string;
  /** GitHub's repository id, as the string the driver exchanges a bigint as. */
  githubRepoId: string;
  /** A display snapshot of `owner/repo`, refreshed whenever the row is written. */
  fullName: string;
  /** Cloned into every new session of the project. */
  isDefault: boolean;
  /** What those sessions branch from; null is the repository's own default branch. */
  baseBranch: string | null;
}

export interface CreateProjectRepositoryProps {
  installationId: string;
  githubRepoId: string;
  fullName: string;
  isDefault?: boolean;
  baseBranch?: string | null;
}

/**
 * One repository a project holds — a row of the project dialog: ticked to be
 * in the project, marked Default to be in every new session, with the base
 * branch beside it. Owned by the project aggregate, which is the only thing
 * that adds, replaces or removes one.
 */
export class ProjectRepositoryEntity extends Entity<ProjectRepositoryProps> {
  static create(create: CreateEntityProps<ProjectRepositoryProps>): ProjectRepositoryEntity {
    return new ProjectRepositoryEntity(create);
  }

  static createNew(props: CreateProjectRepositoryProps): ProjectRepositoryEntity {
    return new ProjectRepositoryEntity({
      id: randomUUID(),
      props: {
        installationId: props.installationId,
        githubRepoId: props.githubRepoId,
        fullName: props.fullName,
        isDefault: props.isDefault ?? false,
        baseBranch: props.baseBranch ?? null,
      },
    });
  }

  get installationId(): string {
    return this.props.installationId;
  }

  get githubRepoId(): string {
    return this.props.githubRepoId;
  }

  get fullName(): string {
    return this.props.fullName;
  }

  /** The repository's own name — the `xrp-mobile` of `acme/xrp-mobile`. */
  get name(): string {
    return this.props.fullName.split('/').pop() ?? this.props.fullName;
  }

  /** GitHub's owner login — the `acme` of `acme/xrp-mobile`. */
  get owner(): string {
    return this.props.fullName.includes('/') ? this.props.fullName.split('/')[0] : '';
  }

  get isDefault(): boolean {
    return this.props.isDefault;
  }

  get baseBranch(): string | null {
    return this.props.baseBranch;
  }

  public validate(): void {
    if (!this.props.installationId?.trim()) {
      throw new ArgumentNotProvidedException('A project repository must name its installation');
    }
    if (!/^\d+$/.test(this.props.githubRepoId ?? '')) {
      throw new ArgumentInvalidException('A GitHub repository id is a positive integer');
    }
    if (!this.props.fullName?.trim()) {
      throw new ArgumentNotProvidedException('A project repository must have a name');
    }
    if (this.props.baseBranch !== null && !this.props.baseBranch.trim()) {
      throw new ArgumentInvalidException('A base branch cannot be blank; omit it for the default');
    }
  }
}
