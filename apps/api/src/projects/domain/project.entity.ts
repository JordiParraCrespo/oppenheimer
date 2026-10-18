import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { ProjectArchivedDomainEvent } from './events/project-archived.domain-event';
import {
  type ProjectRepositoryProps,
  projectRepositoriesProblem,
} from './project-repositories.policy';
import { PROJECT_SLUG_MAX_LENGTH, PROJECT_SLUG_PATTERN } from './project-slug.policy';

/** The name every workspace's Unassigned project carries. It cannot be changed. */
export const UNASSIGNED_PROJECT_NAME = 'Unassigned';

/** The slug the Unassigned project takes when no project of the workspace holds it. */
export const UNASSIGNED_PROJECT_SLUG = 'unassigned';

/**
 * What the console calls the Unassigned project in each locale
 * (`projects.unassigned` in `@oppenheimer/translations`, which the domain may
 * not import; `project.entity.spec.ts` holds the two lists together).
 */
export const UNASSIGNED_PROJECT_LABELS: readonly string[] = [
  UNASSIGNED_PROJECT_NAME,
  'Sin asignar',
];

/**
 * Whether `name` would read as the Unassigned project's in any locale, whatever
 * its case or spacing. Only the workspace's own Unassigned project carries it:
 * a second one shows in the sidebar as a second Unassigned group nobody can
 * tell apart.
 */
export function isReservedProjectName(name: string): boolean {
  const candidate = name.trim().toLocaleLowerCase();
  return UNASSIGNED_PROJECT_LABELS.some((label) => label.toLocaleLowerCase() === candidate);
}

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
   * The repositories the project holds, in the order a person put them. It may
   * be empty for any project; a list that is not holds a default, no repository
   * twice, at most twenty, each with a base (`projectRepositoriesProblem`).
   */
  repositories: ProjectRepositoryProps[];
  /**
   * The host a new session is offered. A suggestion, never a grant: creating a
   * session still loads the host through the caller's own-or-grant scope.
   */
  defaultHostId: string | null;
  /** The agent a new session is offered, from the closed catalog. */
  defaultAgent: string | null;
  /**
   * The workspace's Unassigned project: where a session that names no project
   * is listed. One per workspace; never renamed, never archived.
   */
  isUnassigned: boolean;
}

export interface CreateProjectProps {
  organizationId: string;
  name: string;
  slug: string;
  /** May be empty; a list that is not holds a default among them. */
  repositories: ProjectRepositoryProps[];
  /** The id to create the row under, when the slug was derived from it. */
  id?: string;
  createdByUserId?: string | null;
  defaultHostId?: string | null;
  defaultAgent?: string | null;
}

/** What a person may change about a project; absent leaves a field as it is. */
export interface ProjectSettings {
  name?: string;
  repositories?: ProjectRepositoryProps[];
  defaultHostId?: string | null;
  defaultAgent?: string | null;
}

/**
 * Project aggregate root — a saved scope a person creates: the repositories its
 * sessions usually work on, and the host and agent a new session is offered (`product/versions/mvp/10-api-modules-and-data-model.md`).
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

  static createNew(props: CreateProjectProps): ProjectEntity {
    assertNameFree(props.name);
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
        isUnassigned: false,
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

  get isUnassigned(): boolean {
    return this.props.isUnassigned;
  }

  /**
   * Change what a person may change: the name, the repositories as a whole set
   * and the defaults. Never the slug, and never the Unassigned project's name.
   *
   * The repositories are replaced, not merged, so the list's invariants hold after
   * every call rather than after the last of several.
   */
  configure(settings: ProjectSettings): void {
    if (settings.name !== undefined && settings.name !== this.props.name) {
      this.assertNotUnassigned('renamed');
      assertNameFree(settings.name);
    }
    if (settings.repositories !== undefined) {
      assertHoldable(settings.repositories);
      this.props.repositories = settings.repositories.map((repository) => ({ ...repository }));
    }
    if (settings.name !== undefined) this.props.name = settings.name;
    if (settings.defaultHostId !== undefined) this.props.defaultHostId = settings.defaultHostId;
    if (settings.defaultAgent !== undefined) this.props.defaultAgent = settings.defaultAgent;
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
    this.assertNotUnassigned('archived');
    if (this.props.archivedAt) return;
    this.props.archivedAt = at;
    this.setUpdatedAt(new Date());
    this.addEvent(
      new ProjectArchivedDomainEvent({
        aggregateId: this.id,
        organizationId: this.props.organizationId,
        reason: 'The project was retired; what starts work in it must stop',
      }),
    );
  }

  /** Display only: the slug stays as it is. */
  rename(name: string): void {
    if (name !== this.props.name) {
      this.assertNotUnassigned('renamed');
      assertNameFree(name);
    }
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
    assertHoldable(this.props.repositories);
  }

  /**
   * The Unassigned project is where unfiled work goes; it keeps its name and its
   * place. The handlers ask first and answer with `PROJECTS_008`; this is the
   * aggregate holding the invariant whatever the caller.
   */
  private assertNotUnassigned(change: 'renamed' | 'archived'): void {
    if (this.props.isUnassigned) {
      throw new ArgumentInvalidException(`The Unassigned project cannot be ${change}`);
    }
  }
}

/**
 * Refuse the Unassigned project's name for any other project. Checked when a
 * name is given, not in `validate`, so a project named so before the rule
 * still loads and can be renamed. The handlers ask first and answer with
 * `PROJECTS_009`.
 */
function assertNameFree(name: string): void {
  if (isReservedProjectName(name)) {
    throw new ArgumentInvalidException(
      `“${UNASSIGNED_PROJECT_NAME}” is the Unassigned project's name`,
    );
  }
}

/** Refuse a repository list a project cannot hold, naming what is wrong with it. */
function assertHoldable(repositories: readonly ProjectRepositoryProps[]): void {
  const problem = projectRepositoriesProblem(repositories);
  if (problem) {
    throw new ArgumentInvalidException(`Project repositories are invalid: ${problem}`);
  }
}
