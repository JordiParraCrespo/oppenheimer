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
export type ProjectBlock = 'name' | 'default';

/**
 * When a project can be saved: a name, and a default among its repositories
 * whenever it holds any. A project may hold none (2026-10-14): it is a place
 * for tasks, memory and sessions, and a folder or terminal session needs no
 * repository.
 */
export function projectBlock(
  name: string,
  rows: readonly RepositoryRowValue[],
): ProjectBlock | null {
  if (!name.trim()) return 'name';
  if (rows.length > 0 && !rows.some((row) => row.isDefault)) return 'default';
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
 * name is not sent for it. The list is always sent, so removing the last
 * repository leaves the project with none.
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
    repositories,
    defaultHostId: values.defaultHostId,
    defaultAgent: values.defaultAgent,
  };
}
