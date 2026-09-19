import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { ProjectArchivedDomainEvent } from './events/project-archived.domain-event';
import { PROJECT_SLUG_MAX_LENGTH, PROJECT_SLUG_PATTERN } from './project-slug.policy';

export interface ProjectProps {
  /** Tenant the project belongs to. Immutable — a project never moves workspace. */
  organizationId: string;
  /** Display name. Free to change, and it is only ever displayed. */
  name: string;
  /**
   * Directory name under `projects/` on every host holding the project. There
   * is no setter: see the class comment.
   */
  slug: string;
  /** GitHub repository whose first session created the project, if any. */
  originGithubRepoId: number | null;
  /** When the project was retired. Rows are never deleted. */
  archivedAt: Date | null;
}

export interface CreateProjectProps {
  organizationId: string;
  name: string;
  slug: string;
  originGithubRepoId?: number | null;
}

/**
 * Project aggregate root — a body of work, and the name its directory takes.
 *
 * **The slug is immutable and the name is free**, and that split is the whole
 * design of this aggregate. `slug` is a directory on every host that holds the
 * project, with live sessions inside it, so a rename that changed it would have
 * to move `projects/<old>/` on every one of those machines; `name` is only ever
 * displayed, so renaming is free. The cost is that a project's directory keeps
 * the name of the repository that created it for ever, which is cheap against
 * moving directories under running work
 * (`product/11-workspace-layout.md`).
 *
 * **Archiving never deletes.** `archivedAt` retires the project and leaves the
 * row, so the unique slug per workspace is a permanent tombstone and a later
 * project can never inherit a retired directory — and with it another
 * project's history.
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

  get originGithubRepoId(): number | null {
    return this.props.originGithubRepoId;
  }

  get archivedAt(): Date | null {
    return this.props.archivedAt;
  }

  get isArchived(): boolean {
    return this.props.archivedAt !== null;
  }

  /** Rename the project. Display only: the slug and every path stay as they are. */
  rename(name: string): void {
    this.props.name = name;
    this.setUpdatedAt(new Date());
    this.validate();
  }

  /**
   * Retire the project, keeping the row and therefore the slug.
   *
   * Idempotent: archiving an archived project keeps the first date and raises
   * nothing, so a retried request does not append a second event.
   */
  archive(): void {
    if (this.isArchived) return;

    this.props.archivedAt = new Date();
    this.setUpdatedAt(new Date());
    this.validate();
    this.addEvent(
      new ProjectArchivedDomainEvent({
        aggregateId: this.id,
        organizationId: this.organizationId,
        slug: this.slug,
        reason: 'A project was archived; its directory name is retired for good',
      }),
    );
  }

  public validate(): void {
    if (!this.props.organizationId?.trim()) {
      throw new ArgumentNotProvidedException('A project must belong to an organization');
    }
    if (!this.props.name?.trim()) {
      throw new ArgumentNotProvidedException('Project name cannot be empty');
    }
    // The slug is a directory name, so an invalid one is not a display problem
    // that a client could work around — it is a path that cannot be created.
    if (!PROJECT_SLUG_PATTERN.test(this.props.slug)) {
      throw new ArgumentInvalidException(
        'Project slug must be lower-case letters, digits and single dashes',
      );
    }
    if (this.props.slug.length > PROJECT_SLUG_MAX_LENGTH) {
      throw new ArgumentInvalidException(
        `Project slug must be at most ${PROJECT_SLUG_MAX_LENGTH} characters`,
      );
    }
  }
}
