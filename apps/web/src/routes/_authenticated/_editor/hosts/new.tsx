import { createFileRoute } from '@tanstack/react-router';
import { AddHostScreen } from '@/features/hosts/screens/add-host';

/**
 * Add a host: the console's one pairing page, behind the host chip's foot
 * row and Settings → Hosts' Add host (`product/versions/mvp/05-screens.md`).
 * `?from=settings` says which opened it: the header reads its parent crumb,
 * its way back and its primary off that — Done, back to Hosts — where the
 * composer's visit ends with Use this host and `/sessions/new?host=`.
 * Unknown keys are carried through, as `__root.tsx` asks.
 */
export const Route = createFileRoute('/_authenticated/_editor/hosts/new')({
  component: AddHostScreen,
  validateSearch: (search: Record<string, unknown>): { from?: 'settings' } => ({
    ...search,
    from: search.from === 'settings' ? 'settings' : undefined,
  }),
});
