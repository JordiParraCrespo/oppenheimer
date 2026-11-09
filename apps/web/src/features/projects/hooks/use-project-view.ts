import { useNavigate, useSearch } from '@tanstack/react-router';

export type ProjectView = 'overview' | 'stats';

/** Which view of a project its page shows, in the URL; a switch keeps the range. */
export function useProjectView() {
  const { view } = useSearch({ from: '/_authenticated/plan/projects_/$projectId' });
  const navigate = useNavigate({ from: '/plan/projects/$projectId' });
  return {
    view: (view ?? 'overview') as ProjectView,
    setView: (next: ProjectView) =>
      navigate({ search: (prev) => ({ ...prev, view: next === 'stats' ? 'stats' : undefined }) }),
  };
}
