import type { RepositoryRowValue } from '@oppenheimer/design-system-web';

/**
 * What the project dialog holds while it is being filled, apart from the
 * name, which is the form's: the rows added, the default host, the default
 * agent.
 */
export interface ProjectDraft {
  rows: readonly RepositoryRowValue[];
  defaultHostId: string | null;
  defaultAgent: string | null;
}

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
  draft: ProjectDraft,
  options: { holdsNone?: boolean } = {},
): ProjectBlock | null {
  if (!name.trim()) return 'name';
  if (draft.rows.length === 0) return options.holdsNone ? null : 'repositories';
  if (!draft.rows.some((row) => row.isDefault)) return 'default';
  return null;
}
