import { createFileRoute } from '@tanstack/react-router';
import { NewSessionScreen } from '@/features/sessions/screens/new-session';

/**
 * New session. `full`, like the rest of `/sessions`: the composer is the
 * console's main pane in the artboards, not a page inside it.
 *
 * `?project=` is the sidebar's "New session here": the project chip starts on
 * that project and its defaults prefill the rest
 * (`product/versions/mvp/12-projects-on-the-console.md`). Unknown keys are
 * carried through, as `__root.tsx` asks.
 */
export const Route = createFileRoute('/_authenticated/sessions/new')({
  component: NewSessionScreen,
  staticData: { pane: 'full' },
  validateSearch: (search: Record<string, unknown>): { project?: string } => ({
    ...search,
    project: typeof search.project === 'string' ? search.project : undefined,
  }),
});
