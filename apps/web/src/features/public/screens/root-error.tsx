import { RouteError } from '@oppenheimer/frontend-web';
import { RootFallback } from '../components/root-fallback';

/** Anything thrown above the layouts, on the last resort's page. */
export function RootErrorScreen({ error }: { error: unknown }) {
  return (
    <RootFallback>
      <RouteError error={error} />
    </RootFallback>
  );
}
