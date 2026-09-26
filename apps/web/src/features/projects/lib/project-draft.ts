import type { RepositoryRowValue } from '@oppenheimer/design-system-web';

/**
 * What the project page holds while it is being filled, apart from the
 * name, which is the form's: the rows the picker ticked, the default host,
 * the default agent.
 */
export interface ProjectDraft {
  rows: readonly RepositoryRowValue[];
  defaultHostId: string | null;
  defaultAgent: string | null;
}

/** Why Save is off, in the order the recap line reads them; `null` is ready. */
export type ProjectBlock = 'name' | 'repositories' | 'default';

/**
 * The export's rule for a project that can be saved
 * (`design/version1/SessionsConsole.dc.html`, `projSaveBlocked`): a name, at
 * least one repository, at least one of them default. A base branch is never
 * empty on this side, because a row without a choice reads the repository's
 * own default.
 */
export function projectBlock(name: string, draft: ProjectDraft): ProjectBlock | null {
  if (!name.trim()) return 'name';
  if (draft.rows.length === 0) return 'repositories';
  if (!draft.rows.some((row) => row.isDefault)) return 'default';
  return null;
}

/** The repositories step's summary, as counts: how many, and how many default. */
export function repositorySummary(rows: readonly RepositoryRowValue[]) {
  return { count: rows.length, defaults: rows.filter((row) => row.isDefault).length };
}
