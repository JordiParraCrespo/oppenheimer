import { createFileRoute } from '@tanstack/react-router';
import { AddHostScreen } from '@/features/hosts/screens/add-host';

/**
 * Add a host: the page over the main column behind the host chip's foot row
 * (`product/versions/mvp/05-screens.md`). The machine it pairs is handed back
 * to New session as `?host=`.
 */
export const Route = createFileRoute('/_authenticated/_editor/hosts/new')({
  component: AddHostScreen,
});
