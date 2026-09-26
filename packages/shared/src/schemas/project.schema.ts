import { z } from 'zod';
import {
  codingAgentSchema,
  displayNameSchema,
  githubRepoIdSchema,
  gitRefSchema,
  installationIdSchema,
} from './primitives';

/**
 * Project shapes.
 *
 * A project is a **saved scope a person creates**: the repositories its sessions
 * usually work on, the base each one branches from, which of them are offered by
 * default, and the host, agent and instructions a new session starts with
 * (`product/versions/mvp/12-projects.md`). The defaults are offered, never
 * applied: a session chooses its own repositories, and they need not be in its
 * project at all.
 *
 * `slug` is in no request body: it is a directory name on every host that holds
 * the project, derived once at creation and never again, so renaming a project
 * never moves a directory with live sessions inside it.
 *
 * Schemas state the constraint only, never a message (`.agents/rules/forms.md`).
 */

/** How many repositories one project may hold. The dialog shows them all at once. */
export const MAX_PROJECT_REPOSITORIES = 20;

/** How long a project's instructions may be, in characters. */
export const MAX_PROJECT_INSTRUCTIONS = 8000;

/**
 * One repository a project holds.
 *
 * `installationId` is **our row's UUID**; `githubRepoId` is GitHub's number. The
 * name is not accepted: the API asks GitHub for it on every write and keeps a
 * display snapshot, because GitHub owns what a repository is called.
 */
export const projectRepositoryInputSchema = z.object({
  installationId: installationIdSchema,
  githubRepoId: githubRepoIdSchema,
  baseBranch: gitRefSchema,
  isDefault: z.boolean(),
});

export type ProjectRepositoryInputDto = z.infer<typeof projectRepositoryInputSchema>;

/**
 * The repository list as a whole. It is replaced as a set on every write, in the
 * order given, so "at least one, at least one default, no repository twice" hold
 * after every call rather than after the last of several.
 */
export const projectRepositoriesSchema = z
  .array(projectRepositoryInputSchema)
  .min(1)
  .max(MAX_PROJECT_REPOSITORIES)
  .refine((repositories) => repositories.some((repository) => repository.isDefault))
  .refine(
    (repositories) =>
      new Set(repositories.map((repository) => repository.githubRepoId)).size ===
      repositories.length,
  );

const projectFields = {
  name: displayNameSchema,
  repositories: projectRepositoriesSchema,
  /** A host the caller can use. Null clears it. A suggestion, never a grant. */
  defaultHostId: z.string().uuid().nullable(),
  /** An agent from the catalog. Null clears it. */
  defaultAgent: codingAgentSchema.nullable(),
  /** Handed to every new session's agent. Empty is none. */
  instructions: z.string().max(MAX_PROJECT_INSTRUCTIONS),
};

/** `POST /projects`. Name and repositories are required; the defaults are not. */
export const createProjectSchema = z.object({
  name: projectFields.name,
  repositories: projectFields.repositories,
  defaultHostId: projectFields.defaultHostId.optional(),
  defaultAgent: projectFields.defaultAgent.optional(),
  instructions: projectFields.instructions.optional(),
});

export type CreateProjectDto = z.infer<typeof createProjectSchema>;

/**
 * `PATCH /projects/{id}`. Every field optional, so a name-only caller keeps
 * working; an absent field is left as it is, and `null` clears a default.
 */
export const updateProjectSchema = z.object({
  name: projectFields.name.optional(),
  repositories: projectFields.repositories.optional(),
  defaultHostId: projectFields.defaultHostId.optional(),
  defaultAgent: projectFields.defaultAgent.optional(),
  instructions: projectFields.instructions.optional(),
});

export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;

/**
 * `GET /projects`.
 *
 * Archived projects are left out by default: a retired project's slug stays
 * claimed for ever so its directory name is never reissued, which means the
 * listing would otherwise grow monotonically with rows nobody can put work in.
 * `includeArchived` is what the settings screen passes to show the history.
 */
export const listProjectsQuerySchema = z.object({
  includeArchived: z.coerce.boolean().optional(),
});

export type ListProjectsQueryDto = z.infer<typeof listProjectsQuerySchema>;
