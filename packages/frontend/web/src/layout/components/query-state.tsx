import { Button } from '@oppenheimer/design-system-web';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { createContext, type ReactNode, Suspense, use } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import { ErrorAlert } from '../../forms';

/** The part of a query result {@link QueryState} branches on. */
export interface QueryStateSource<T> {
  isPending: boolean;
  error: unknown;
  data: T | undefined;
}

/**
 * Several reads as one source, for a section that can draw nothing until all
 * of them have answered: pending while any is, failed with the first failure,
 * and `combine`d once every one holds data. The sessions sidebar groups its
 * sessions under their projects, so it needs both.
 */
export function combineQueries<A, B, T>(
  a: QueryStateSource<A>,
  b: QueryStateSource<B>,
  combine: (a: A, b: B) => T,
): QueryStateSource<T> {
  const settled = a.data !== undefined && b.data !== undefined;
  return {
    isPending: a.isPending || b.isPending,
    error: a.error ?? b.error ?? null,
    data: settled ? combine(a.data as A, b.data as B) : undefined,
  };
}

/**
 * The rung a read is on, decided once by the root and read by every slot:
 * `failure` is set whenever the read failed, and `rung` says what draws
 * beside it — nothing (`failed`), the placeholder, the empty state or the data.
 * `retry` is set only under a Suspense root, whose failure can be tried again.
 */
interface Rung {
  rung: 'failed' | 'pending' | 'empty' | 'data';
  failure: { error: unknown } | null;
  retry?: () => void;
}

/**
 * The ladder, in its one order. A failure wins over everything unless it is a
 * stale one (data already arrived) that the caller asked to `keep`; then the
 * data still draws, and `failure` draws beside it. Until data arrives, the
 * read is pending; `isPending` is not read, so the ladder hangs on the one
 * field every rung below it needs.
 */
export function rungOf<T>(
  { error, data }: QueryStateSource<T>,
  isEmpty: ((data: T) => boolean) | undefined,
  stale: 'replace' | 'keep',
): Rung {
  const failure = error !== null && error !== undefined ? { error } : null;
  const keepsData = stale === 'keep' && data !== undefined;
  if (failure && !keepsData) return { rung: 'failed', failure };
  if (data === undefined) return { rung: 'pending', failure };
  return { rung: isEmpty?.(data) ? 'empty' : 'data', failure };
}

const RungContext = createContext<Rung | null>(null);

function useRung(slot: string): Rung {
  const rung = use(RungContext);
  if (!rung) throw new Error(`<QueryState.${slot}> is drawn outside a <QueryState>`);
  return rung;
}

/**
 * The four states of a read, in one order: failed, still loading, empty, or
 * there. Hand-written, the ladder lost rungs: a failed read spun a skeleton
 * for ever, or read as "No projects".
 *
 * The root decides the rung; each slot draws its own and nothing else, where
 * the caller puts it. Two kinds of read compose the same slots:
 *
 * ```tsx
 * // a query the section holds: the root reads it
 * <QueryState query={hosts} isEmpty={(rows) => rows.length === 0}>
 *   <QueryState.Pending><Skeleton className="h-18 w-full" /></QueryState.Pending>
 *   <QueryState.Error fallback={t('settings.hosts.failed')} />
 *   <QueryState.Empty><HostsEmpty … /></QueryState.Empty>
 *   <QueryState.Data of={hosts}>{(rows) => <HostRows rows={rows} />}</QueryState.Data>
 * </QueryState>
 *
 * // a Suspense read: no `query`; the section in `Data` reads and suspends
 * <QueryState>
 *   <QueryState.Pending><Skeleton className="h-18 w-full" /></QueryState.Pending>
 *   <QueryState.Error fallback={t('settings.hosts.failed')} />
 *   <QueryState.Data><HostListRows /></QueryState.Data>
 * </QueryState>
 * ```
 *
 * With a `query`, `stale` decides what a later failure does to data on
 * screen: `"replace"` (the default) shows the failure in its place; `"keep"`
 * keeps the data and the failure beside it — a page of runs a refetch failed
 * to replace is still the page the reader was reading. The failure draws
 * where `Error` sits. It takes the query the section already holds and moves
 * no subscription, as the render rules ask.
 *
 * Without one, the root is the boundary of a Suspense read (TanStack's recipe:
 * `react-error-boundary` inside `QueryErrorResetBoundary`). Its children draw
 * three times — under `<Suspense>`, as its placeholder, and as the boundary's
 * fallback — and each slot draws in its own place only. A first failure lands
 * on `Error` with Try again, which resets the failed queries so they fetch
 * rather than rethrow; a refetch that fails over drawn data does not throw,
 * and the section shows its read's `error` beside the data.
 *
 * `pnpm check:structure` holds every use to a `Pending`, an `Error` and a
 * `Data`, an `Empty` exactly when `isEmpty` is given, and no `query`-only
 * slot or prop on a Suspense root.
 */
function QueryStateRoot<T>(props: {
  query: QueryStateSource<T>;
  /** What counts as an empty answer; `QueryState.Empty` draws it. */
  isEmpty?: (data: T) => boolean;
  /** A failure after data arrived: show it instead (`replace`) or beside it (`keep`). */
  stale?: 'replace' | 'keep';
  children: ReactNode;
}): ReactNode;
function QueryStateRoot(props: { children: ReactNode }): ReactNode;
function QueryStateRoot<T>({
  query,
  isEmpty,
  stale = 'replace',
  children,
}: {
  query?: QueryStateSource<T>;
  isEmpty?: (data: T) => boolean;
  stale?: 'replace' | 'keep';
  children: ReactNode;
}) {
  if (!query) return <SuspenseRoot>{children}</SuspenseRoot>;
  return <RungContext value={rungOf(query, isEmpty, stale)}>{children}</RungContext>;
}

const SUSPENDED: Rung = { rung: 'pending', failure: null };
const RESOLVED: Rung = { rung: 'data', failure: null };

function SuspenseRoot({ children }: { children: ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <RungContext value={{ rung: 'failed', failure: { error }, retry: resetErrorBoundary }}>
              {children}
            </RungContext>
          )}
        >
          <Suspense fallback={<RungContext value={SUSPENDED}>{children}</RungContext>}>
            <RungContext value={RESOLVED}>{children}</RungContext>
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
 * The failure: `ErrorAlert` with the section's already-translated `fallback`
 * for a code with no sentence of its own, or `children` to say it another way
 * (a screen's `RouteError`, a 404 said as "not found"). Under a Suspense root
 * the alert carries Try again.
 */
function QueryStateError(
  props:
    | { fallback: string; className?: string; children?: never }
    | { children: (error: unknown) => ReactNode },
) {
  const { t } = useTranslation();
  const { failure, retry } = useRung('Error');
  if (!failure) return null;
  if ('fallback' in props)
    return (
      <ErrorAlert
        error={failure.error}
        fallback={props.fallback}
        className={props.className}
        action={
          retry ? (
            <Button variant="ghost" size="sm" onClick={retry}>
              {t('common.retry')}
            </Button>
          ) : undefined
        }
      />
    );
  return props.children(failure.error);
}

/** What an answer the root's `isEmpty` calls empty shows. */
function QueryStateEmpty({ children }: { children: ReactNode }) {
  return useRung('Empty').rung === 'empty' ? children : null;
}

/**
 * The answer. Under a root with a `query`, handed to `children`: a function
 * because the data only exists on this rung. The root decides *whether* it
 * draws; `of` (the root's own query) is *what* it draws, so the data is typed
 * from the query itself and nothing is cast — a slot cannot see the root's
 * type. `check:structure` holds `of` to the root's `query`. Under a Suspense
 * root, `children` is the section that reads, with no `of`.
 */
function QueryStateData<T>(props: {
  of: QueryStateSource<T>;
  children: (data: T) => ReactNode;
}): ReactNode;
function QueryStateData(props: { children: ReactNode }): ReactNode;
function QueryStateData<T>({
  of,
  children,
}: {
  of?: QueryStateSource<T>;
  children: ReactNode | ((data: T) => ReactNode);
}) {
  const { rung } = useRung('Data');
  if (rung !== 'data') return null;
  if (!of) return children as ReactNode;
  return of.data !== undefined ? (children as (data: T) => ReactNode)(of.data) : null;
}

export const QueryState = Object.assign(QueryStateRoot, {
  Pending: QueryStatePending,
  Error: QueryStateError,
  Empty: QueryStateEmpty,
  Data: QueryStateData,
});
