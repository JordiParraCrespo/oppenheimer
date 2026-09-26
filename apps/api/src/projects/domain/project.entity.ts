import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import {
  type ProjectRepositoryProps,
  projectRepositoriesProblem,
} from './project-repositories.policy';
import { PROJECT_SLUG_MAX_LENGTH, PROJECT_SLUG_PATTERN } from './project-slug.policy';

/** How long a project's instructions may be, in characters. Kept equal to the shared schema's. */
export const MAX_PROJECT_INSTRUCTIONS = 8000;

export interface ProjectProps {
  /** Tenant the project belongs to. Immutable — a project never moves workspace. */
  organizationId: string;
  /** Display name. Free to change. */
  name: string;
  /** The project's stable handle, derived from its first name. There is no setter. */
  slug: string;
  /**
   * When the project was retired. Set by the archive command, which refuses while
   * the project still holds sessions nobody has closed — a question only the module
   * that owns sessions can answer.
   */
  archivedAt: Date | null;
  /** Who created the project. Audit only; null once that account is gone. */
  createdByUserId: string | null;
  /**
   * The repositories the project holds, in the order a person put them. Empty
   * only for a project from before projects held repositories that had no
   * checkout to backfill from; every write leaves at least one.
   */
  repositories: ProjectRepositoryProps[];
  /** The host a new session is offered. A suggestion, never a grant. */
  defaultHostId: string | null;
  /** The agent a new session is offered, from the closed catalog. */
  defaultAgent: string | null;
  /** Handed to every new session's agent. Empty is none. */
  instructions: string;
}

export interface CreateProjectProps {
  organizationId: string;
  name: string;
  slug: string;
  /** At least one, and at least one of them a default. */
  repositories: ProjectRepositoryProps[];
  /** The id to create the row under, when the slug was derived from it. */
  id?: string;
  createdByUserId?: string | null;
  defaultHostId?: string | null;
  defaultAgent?: string | null;
  instructions?: string;
}

/** What a person may change about a project; absent leaves a field as it is. */
export interface ProjectSettings {
  name?: string;
  repositories?: ProjectRepositoryProps[];
  defaultHostId?: string | null;
  defaultAgent?: string | null;
  instructions?: string;
}

/**
 * Project aggregate root — a saved scope a person creates: the repositories its
 * sessions usually work on, and the host, agent and instructions a new session
 * is offered (`product/versions/mvp/10-api-modules-and-data-model.md`).
 *
 * A project is **metadata only**. Nothing on a host is named after it, so a
 * session can be listed under any project without anything moving, and renaming
 * is free. The slug is a stable handle derived from the first name; archiving
 * keeps it, so it is never reissued.
 */
export class ProjectEntity extends AggregateRoot<ProjectProps> {
  /** Rehydrate an existing project (used by the mapper). */
  static create(create: CreateEntityProps<ProjectProps>): ProjectEntity {
    return new ProjectEntity(create);
  }

  /** Create a brand-new project with a generated id. */
  static createNew(props: CreateProjectProps): ProjectEntity {
    assertHoldable(props.repositories);
    return new ProjectEntity({
      id: props.id ?? randomUUID(),
      props: {
        organizationId: props.organizationId,
        name: props.name,
        slug: props.slug,
        archivedAt: null,
        createdByUserId: props.createdByUserId ?? null,
        repositories: props.repositories.map((repository) => ({ ...repository })),
        defaultHostId: props.defaultHostId ?? null,
        defaultAgent: props.defaultAgent ?? null,
        instructions: props.instructions ?? '',
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

  get archivedAt(): Date | null {
    return this.props.archivedAt;
  }

  get isArchived(): boolean {
    return this.props.archivedAt !== null;
  }

  get createdByUserId(): string | null {
    return this.props.createdByUserId;
  }

  /** A copy: the list is changed only through {@link configure}. */
  get repositories(): ProjectRepositoryProps[] {
    return this.props.repositories.map((repository) => ({ ...repository }));
  }

  get defaultHostId(): string | null {
    return this.props.defaultHostId;
  }

  get defaultAgent(): string | null {
    return this.props.defaultAgent;
  }

  get instructions(): string {
    return this.props.instructions;
  }

  /**
   * Change what a person may change: the name, the repositories as a whole set,
   * the defaults and the instructions. Never the slug.
   *
   * The repositories are replaced, not merged, so the list's invariants hold after
   * every call rather than after the last of several.
   */
  configure(settings: ProjectSettings): void {
    if (settings.repositories !== undefined) {
      assertHoldable(settings.repositories);
      this.props.repositories = settings.repositories.map((repository) => ({ ...repository }));
    }
    if (settings.name !== undefined) this.props.name = settings.name;
    if (settings.defaultHostId !== undefined) this.props.defaultHostId = settings.defaultHostId;
    if (settings.defaultAgent !== undefined) this.props.defaultAgent = settings.defaultAgent;
    if (settings.instructions !== undefined) this.props.instructions = settings.instructions;
    this.setUpdatedAt(new Date());
    this.validate();
  }

  /**
   * Retire the project. Idempotent: the first archive is the one that counts.
   *
   * There is no un-archive. The slug stays with the retired row and is never
   * reissued, so a link to a retired project can never land on a new one.
   */
  archive(at: Date): void {
    this.props.archivedAt = this.props.archivedAt ?? at;
    this.setUpdatedAt(new Date());
  }

  /** Rename the project. Display only: the slug stays as it is. */
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
    // The slug is a handle that sits in URLs, so it is held to its shape here.
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
    if (this.props.instructions.length > MAX_PROJECT_INSTRUCTIONS) {
      throw new ArgumentInvalidException(
        `Project instructions must be at most ${MAX_PROJECT_INSTRUCTIONS} characters`,
      );
    }
    // An empty list is a legacy row the backfill could not fill, and it is read,
    // not written; anything non-empty must be a list a project can hold.
    if (this.props.repositories.length > 0) assertHoldable(this.props.repositories);
  }
}

/** Refuse a repository list a project cannot hold, naming what is wrong with it. */
function assertHoldable(repositories: readonly ProjectRepositoryProps[]): void {
  const problem = projectRepositoriesProblem(repositories);
  if (problem) {
    throw new ArgumentInvalidException(`Project repositories are invalid: ${problem}`);
  }
}
