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
 * The project dialog's draft: the form's shape, its start, when it can be
 * saved and what it sends. What is picked (rows, default host, default agent)
 * lives in the same form so each picker subscribes to its own field. A row's
 * branch is never empty: an added row takes its repository's default branch,
 * a saved one its base.
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
 * least one repository, at least one of them default. The workspace's
 * Unassigned project (`holdsNone`) is where work naming no project goes, so it
 * may hold no repository; one it does hold still needs a default.
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
