import { Button } from '@oppenheimer/design-system-web';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { createContext, type ReactNode, Suspense, use } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import { ErrorAlert } from '../../forms';

/**
 * The rung a read is on, decided by the root and read by every slot: still
 * loading, failed (with the boundary's `retry`), or there.
 */
type Rung =
  | { rung: 'pending' }
  | { rung: 'failed'; error: unknown; retry: () => void }
  | { rung: 'data' };

const RungContext = createContext<Rung | null>(null);

function useRung(slot: string): Rung {
  const rung = use(RungContext);
  if (!rung) throw new Error(`<QueryState.${slot}> is drawn outside a <QueryState>`);
  return rung;
}

const PENDING: Rung = { rung: 'pending' };
const DATA: Rung = { rung: 'data' };

/**
 * The boundary of a Suspense read, and the three states it draws in one
 * order: still loading, failed, or there. Hand-written, the ladder lost rungs:
 * a failed read spun a skeleton for ever, or read as "No projects".
 *
 * The section in `Data` reads through a product package's `useSuspense…`
 * hook, so its `data` is never `undefined`; the root draws the read's other
 * states, and each slot draws its own and nothing else, where the caller puts
 * it:
 *
 * ```tsx
 * <QueryState>
 *   <QueryState.Pending><HostListSkeleton /></QueryState.Pending>
 *   <QueryState.Error fallback={t('settings.hosts.failed')} />
 *   <QueryState.Data><HostListRows /></QueryState.Data>
 * </QueryState>
 * ```
 *
 * `Pending` draws the section's shape (its container, its labels, a bar per
 * line), not a slab: `.agents/rules/frontend-ui.md`, "A placeholder has the
 * shape of what replaces it".
 *
 * TanStack's recipe: `react-error-boundary` inside `QueryErrorResetBoundary`.
 * The children draw three times — under `<Suspense>`, as its placeholder, and
 * as the boundary's fallback — and each slot draws in its own place only. A
 * first failure lands on `Error` with Try again, which resets the failed
 * queries so they fetch rather than rethrow; a refetch that fails over drawn
 * data does not throw, and the section shows its read's `error` beside the
 * data. An empty answer is the section's own branch: only it knows what empty
 * means. A read whose key the URL moves reads that key through
 * `useDeferredValue`, so the page on screen stays while the next one loads.
 *
 * `pnpm check:structure` holds every use to a `Pending`, an `Error` and a
 * `Data`, and every Suspense read to an `ErrorAlert` for the later failure.
 */
function QueryStateRoot({ children }: { children: ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <RungContext value={{ rung: 'failed', error, retry: resetErrorBoundary }}>
              {children}
            </RungContext>
          )}
        >
          <Suspense fallback={<RungContext value={PENDING}>{children}</RungContext>}>
            <RungContext value={DATA}>{children}</RungContext>
          </Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

/** What holds the place until the first answer: skeletons, usually. */
function QueryStatePending({ children }: { children: ReactNode }) {
  return useRung('Pending').rung === 'pending' ? children : null;
}

/**
 * A first failure: `ErrorAlert` with the section's already-translated
 * `fallback` for a code with no sentence of its own, and Try again; or
 * `children` to say it another way (a screen's `RouteError`, a 404 said as
 * "not found"), handed the same `retry` — only it resets the boundary, so
 * another way of saying the failure wires its own button to it.
 */
function QueryStateError(
  props:
    | { fallback: string; className?: string; children?: never }
    | { children: (error: unknown, retry: () => void) => ReactNode },
) {
  const { t } = useTranslation();
  const rung = useRung('Error');
  if (rung.rung !== 'failed') return null;
  if ('fallback' in props)
    return (
      <ErrorAlert
        error={rung.error}
        fallback={props.fallback}
        className={props.className}
        action={
          <Button variant="ghost" size="sm" onClick={rung.retry}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  return props.children(rung.error, rung.retry);
}

/** The section that reads, once its read has answered. */
function QueryStateData({ children }: { children: ReactNode }) {
  return useRung('Data').rung === 'data' ? children : null;
}

export const QueryState = Object.assign(QueryStateRoot, {
  Pending: QueryStatePending,
  Error: QueryStateError,
  Data: QueryStateData,
});
