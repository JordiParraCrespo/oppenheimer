import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { PROJECT_SLUG_MAX_LENGTH, PROJECT_SLUG_PATTERN } from './project-slug.policy';

export interface ProjectProps {
  /** Tenant the project belongs to. Immutable — a project never moves workspace. */
  organizationId: string;
  /** Display name: the GitHub repository's name as GitHub spells it. Free to change. */
  name: string;
  /**
   * Directory name under `projects/` on every host holding the project. There is
   * no setter: see the class comment.
   */
  slug: string;
  /**
   * GitHub's repository id, kept as the string the driver exchanges a bigint as.
   * GitHub's ids are inside the safe integer range today and the column says
   * they will not stay there, so nothing here converts.
   */
  originGithubRepoId: string | null;
  /**
   * When the project was retired. Set by the archive command, which refuses while
   * the project still holds sessions nobody has closed — a question only the module
   * that owns sessions can answer.
   */
  archivedAt: Date | null;
}

export interface CreateProjectProps {
  organizationId: string;
  name: string;
  slug: string;
  originGithubRepoId?: string | null;
}

/**
 * Project aggregate root — a body of work, and the name its directory takes.
 *
 * A project sits above the repository on disk, because a session may check out
 * several:
 * `~/oppenheimer-ai/workspaces/<org.slug>/projects/<project.slug>/`
 * (`product/11-workspace-layout.md`, `product/versions/mvp/03-control-plane.md`).
 *
 * **The slug is immutable and the name is free**, and that split is the whole
 * design of this aggregate. The slug is a directory on every host that holds the
 * project, with work inside it, so a rename that changed it would have to move
 * `projects/<old>/` on every one of those machines; the name is only ever
 * displayed, so renaming is free. The cost is that a project's directory keeps
 * the name of the repository that created it for ever, which is cheap against
 * moving directories under running work.
 *
 * `archivedAt` is the column that keeps a retired slug out of circulation.
 */
export class ProjectEntity extends AggregateRoot<ProjectProps> {
  /** Rehydrate an existing project (used by the mapper). */
  static create(create: CreateEntityProps<ProjectProps>): ProjectEntity {
    return new ProjectEntity(create);
  }

  /** Create a brand-new project with a generated id. */
  static createNew(props: CreateProjectProps): ProjectEntity {
    return new ProjectEntity({
      id: randomUUID(),
      props: {
        organizationId: props.organizationId,
        name: props.name,
        slug: props.slug,
        originGithubRepoId: props.originGithubRepoId ?? null,
        archivedAt: null,
      },
    });
  }

  get organizationId(): string {
    return this.props.organizationId;
  }

  get name(): string {
    return this.props.name;
  }

  get slug(): string {
    return this.props.slug;
  }

  get originGithubRepoId(): string | null {
    return this.props.originGithubRepoId;
  }

  get archivedAt(): Date | null {
    return this.props.archivedAt;
  }

  get isArchived(): boolean {
    return this.props.archivedAt !== null;
  }

  /**
   * Retire the project. Idempotent: the first archive is the one that counts.
   *
   * There is no un-archive, and that is the point. The slug is a directory name on
   * every host that held the project and it is never reissued, so archiving is a
   * one-way door by construction rather than by policy.
   */
  archive(at: Date): void {
    this.props.archivedAt = this.props.archivedAt ?? at;
    this.setUpdatedAt(new Date());
  }

  /** Rename the project. Display only: the slug and every path stay as they are. */
  rename(name: string): void {
    this.props.name = name;
    this.setUpdatedAt(new Date());
    this.validate();
  }

  public validate(): void {
    if (!this.props.organizationId?.trim()) {
      throw new ArgumentNotProvidedException('A project must belong to an organization');
    }
    if (!this.props.name?.trim()) {
      throw new ArgumentNotProvidedException('Project name cannot be empty');
    }
    // The slug is a directory name, so an invalid one is not a display problem a
    // client could work around — it is a path that cannot be created.
    if (!PROJECT_SLUG_PATTERN.test(this.props.slug)) {
      throw new ArgumentInvalidException(
        'Project slug must be lower-case letters, digits and dashes',
      );
    }
    if (this.props.slug.length > PROJECT_SLUG_MAX_LENGTH) {
      throw new ArgumentInvalidException(
        `Project slug must be at most ${PROJECT_SLUG_MAX_LENGTH} characters`,
      );
    }
  }
}
