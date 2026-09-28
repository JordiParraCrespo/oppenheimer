import type { RepositoryRowValue } from '@oppenheimer/design-system-web';
import {
  type ProjectEntity,
  parseRepositoryKey,
  repositoryKey,
  type UpdateProjectInput,
} from '@oppenheimer/frontend-consumer';
import { CODING_AGENT_IDS } from '@oppenheimer/shared/agents';
import { createProjectSchema } from '@oppenheimer/shared/schemas/project';
import { z } from 'zod';

/**
 * The project dialog's draft, in one place: the form's shape, what it starts
 * from, when it can be saved, and what it sends.
 *
 * The form holds the name the API validates and what is picked rather than
 * typed — the rows added, the default host, the default agent — as fields of
 * the same form, so each picker binds its own field and the one that shows an
 * answer is the one that subscribes to it. A row's branch is never empty: an
 * added row takes its repository's default branch, and a saved one has its
 * base.
 */
export const projectFormSchema = createProjectSchema.pick({ name: true }).extend({
  rows: z.array(z.object({ id: z.string(), isDefault: z.boolean(), branch: z.string() })),
  defaultHostId: z.string().nullable(),
  defaultAgent: z.enum(CODING_AGENT_IDS).nullable(),
});
export type ProjectFormValues = z.infer<typeof projectFormSchema>;

/** Why Save is off, in the order they are checked; `null` is ready. */
export type ProjectBlock = 'name' | 'repositories' | 'default';

/**
 * The export's rule for a project that can be saved
 * (`design/version1/SessionsConsole.dc.html`, `projSaveBlocked`): a name, at
 * least one repository, at least one of them default. A base branch is never
 * empty on this side, because a row without a choice reads the repository's
 * own default.
 *
 * The workspace's Unassigned project (`holdsNone`) may hold no repository at
 * all — it is where work that names no project goes — so an empty list does
 * not block it; one it does hold still needs a default.
 */
export function projectBlock(
  name: string,
  rows: readonly RepositoryRowValue[],
  options: { holdsNone?: boolean } = {},
): ProjectBlock | null {
  if (!name.trim()) return 'name';
  if (rows.length === 0) return options.holdsNone ? null : 'repositories';
  if (!rows.some((row) => row.isDefault)) return 'default';
  return null;
}

/** The form's starting values: the project's, or an empty one. */
export function projectDraftOf(project: ProjectEntity | undefined): ProjectFormValues {
  return {
    name: project?.name ?? '',
    rows: (project?.repositories ?? []).map((repository) => ({
      id: repositoryKey({
        installationId: repository.installationId,
        githubRepoId: repository.githubRepoId,
      }),
      isDefault: repository.isDefault,
      branch: repository.baseBranch,
    })),
    defaultHostId: project?.defaultHostId ?? null,
    defaultAgent: project?.defaultAgent ?? null,
  };
}

/**
 * What a save sends. A row whose id no longer parses is dropped rather than
 * sent. The workspace's Unassigned project (`fixed`) keeps its name, so the
 * name is not sent for it, and with no repository it leaves the list as it is:
 * the API holds a project's repositories to at least one whenever they are
 * sent.
 */
export function projectInputOf(
  values: ProjectFormValues,
  { fixed = false }: { fixed?: boolean } = {},
): UpdateProjectInput {
  const repositories = values.rows.flatMap((row) => {
    const ref = parseRepositoryKey(row.id);
    return ref ? [{ ...ref, isDefault: row.isDefault, baseBranch: row.branch }] : [];
  });
  return {
    ...(fixed ? {} : { name: values.name.trim() }),
    ...(fixed && repositories.length === 0 ? {} : { repositories }),
    defaultHostId: values.defaultHostId,
    defaultAgent: values.defaultAgent,
  };
}
