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
 * A project is the body of work a session belongs to
 * (`product/versions/mvp/12-projects-on-the-console.md`): a free display name
 * over an immutable slug, the repositories it holds, and the defaults New
 * session is prefilled with when the project is picked.
 *
 * `slug` is absent from every input: it is a directory name on every host that
 * holds the project, so it is derived on the server — from the first default
 * repository, else the first repository, else the name — and never renamed.
 * A path is never an identity.
 *
 * Schemas state the constraint only, never a message (`.agents/rules/forms.md`).
 */

/** How many repositories a project may list. A body of work, not an organisation. */
export const MAX_PROJECT_REPOSITORIES = 20;

/**
 * One repository of a project.
 *
 * `installationId` is **our row's UUID**, as on a session checkout. `isDefault`
 * marks a repository cloned into every new session of the project; `baseBranch`
 * is what those sessions branch from, and absent means the repository's own
 * default branch, read live.
 */
export const projectRepositorySchema = z.object({
  installationId: installationIdSchema,
  githubRepoId: githubRepoIdSchema,
  isDefault: z.boolean().default(false),
  baseBranch: gitRefSchema.optional(),
});

export type ProjectRepositoryDto = z.infer<typeof projectRepositorySchema>;

/** `POST /projects`. What the New project dialog sends. */
export const createProjectSchema = z.object({
  name: displayNameSchema,
  repositories: z.array(projectRepositorySchema).max(MAX_PROJECT_REPOSITORIES).default([]),
  /** The host New session picks first for this project. */
  defaultHostId: z.string().uuid().optional(),
  /** The agent New session picks first for this project. */
  defaultAgent: codingAgentSchema.optional(),
});

export type CreateProjectDto = z.infer<typeof createProjectSchema>;

/**
 * `PATCH /projects/{id}`. Every field optional, and only the given ones change:
 * `repositories` given replaces the set, `defaultHostId: null` clears the host.
 */
export const updateProjectSchema = z.object({
  name: displayNameSchema.optional(),
  repositories: z.array(projectRepositorySchema).max(MAX_PROJECT_REPOSITORIES).optional(),
  defaultHostId: z.string().uuid().nullable().optional(),
  defaultAgent: codingAgentSchema.nullable().optional(),
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
