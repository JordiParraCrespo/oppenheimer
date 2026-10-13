import { createContext, type ReactNode, use } from 'react';
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
 */
interface Rung {
  rung: 'failed' | 'pending' | 'empty' | 'data';
  failure: { error: unknown } | null;
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
 * the caller puts it:
 *
 * ```tsx
 * <QueryState query={hosts} isEmpty={(rows) => rows.length === 0}>
 *   <QueryState.Pending><Skeleton className="h-18 w-full" /></QueryState.Pending>
 *   <QueryState.Error fallback={t('settings.hosts.failed')} />
 *   <QueryState.Empty><HostsEmpty … /></QueryState.Empty>
 *   <QueryState.Data of={hosts}>{(rows) => <HostRows rows={rows} />}</QueryState.Data>
 * </QueryState>
 * ```
 *
 * `stale` decides what a later failure does to data on screen: `"replace"`
 * (the default) shows the failure in its place; `"keep"` keeps the data and
 * the failure beside it — a page of runs a refetch failed to replace is still
 * the page the reader was reading. The failure draws where `Error` sits.
 *
 * It takes the query the section already holds and moves no subscription, as
 * the render rules ask. `pnpm check:structure` holds every use to a
 * `Pending`, an `Error` and a `Data`, and an `Empty` exactly when `isEmpty`
 * is given.
 */
function QueryStateRoot<T>({
  query,
  isEmpty,
  stale = 'replace',
  children,
}: {
  query: QueryStateSource<T>;
  /** What counts as an empty answer; `QueryState.Empty` draws it. */
  isEmpty?: (data: T) => boolean;
  /** A failure after data arrived: show it instead (`replace`) or beside it (`keep`). */
  stale?: 'replace' | 'keep';
  children: ReactNode;
}) {
  return <RungContext value={rungOf(query, isEmpty, stale)}>{children}</RungContext>;
}

/** What holds the place until the first answer: skeletons, usually. */
function QueryStatePending({ children }: { children: ReactNode }) {
  return useRung('Pending').rung === 'pending' ? children : null;
}

/**
 * The failure: `ErrorAlert` with the section's already-translated `fallback`
 * for a code with no sentence of its own, or `children` to say it another way
 * (a screen's `RouteError`, a 404 said as "not found").
 */
function QueryStateError(
  props:
    | { fallback: string; className?: string; children?: never }
    | { children: (error: unknown) => ReactNode },
) {
  const { failure } = useRung('Error');
  if (!failure) return null;
  if ('fallback' in props)
    return (
      <ErrorAlert error={failure.error} fallback={props.fallback} className={props.className} />
    );
  return props.children(failure.error);
}

/** What an answer the root's `isEmpty` calls empty shows. */
function QueryStateEmpty({ children }: { children: ReactNode }) {
  return useRung('Empty').rung === 'empty' ? children : null;
}

/**
 * The answer, handed to `children`: a function because the data only exists
 * on this rung. The root decides *whether* it draws; `of` (the root's own
 * query) is *what* it draws, so the data is typed from the query itself and
 * nothing is cast — a slot cannot see the root's type. `check:structure`
 * holds `of` to the root's `query`.
 */
function QueryStateData<T>({
  of,
  children,
}: {
  of: QueryStateSource<T>;
  children: (data: T) => ReactNode;
}) {
  const { rung } = useRung('Data');
  return rung === 'data' && of.data !== undefined ? children(of.data) : null;
}

export const QueryState = Object.assign(QueryStateRoot, {
  Pending: QueryStatePending,
  Error: QueryStateError,
  Empty: QueryStateEmpty,
  Data: QueryStateData,
});
