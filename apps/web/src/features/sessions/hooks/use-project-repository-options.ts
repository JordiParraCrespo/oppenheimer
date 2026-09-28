import type { RepositoryRowOption, RepositoryRowValue } from '@oppenheimer/design-system-web';
import { parseRepositoryKey } from '@oppenheimer/frontend-consumer';
import {
  useInstallationRepositoriesFor,
  useInstallations,
  useRepositoryBranchesFor,
} from '@oppenheimer/frontend-consumer/react';
import { toProjectRepositoryRows } from '../lib/project-rows';

/**
 * The project dialog's repositories as its pickers list them: every
 * repository the workspace's installations reach, with the branches of the
 * rows added so far — only those, as on the scope chip: a call per row nobody
 * added is a rate limit spent on nothing.
 *
 * Each picker that lists them calls this itself, so it is the component that
 * draws the answer that subscribes to it; the queries are shared, not fetched
 * twice.
 */
export function useProjectRepositoryOptions(rows: readonly RepositoryRowValue[]): {
  options: RepositoryRowOption[];
  loading: boolean;
  error: Error | null;
} {
  const installations = useInstallations();
  const repositories = useInstallationRepositoriesFor(
    (installations.data ?? []).map((installation) => installation.id),
  );
  const branches = useRepositoryBranchesFor(
    rows.flatMap((row) => {
      const ref = parseRepositoryKey(row.id);
      return ref ? [ref] : [];
    }),
  );

  return {
    options: toProjectRepositoryRows(repositories.repositories, branches.byRepository),
    loading: installations.isPending || repositories.isPending,
    error: installations.error ?? repositories.error,
  };
}
