/**
 * Whether a failure carries the server's answer: a status, or a code the
 * server or a repository put on it. Screens resolve such a failure's words
 * (`RouteError`), and error reporting leaves it alone unless it wraps a bug.
 */
export function isRequestFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { status, code } = error as { status?: unknown; code?: unknown };
  return typeof status === 'number' || (typeof code === 'string' && code !== '');
}

/**
 * The bug of ours a failure is or carries, or `undefined` when there is none.
 * A request the server answered is not one: a 4xx is a refusal, and the API
 * reports its own 5xx with the stack the browser never sees. A request that
 * got no answer is the network's. A repository wraps whatever its call threw
 * in its fallback error (`callApi`), with no status: a mapper's `TypeError`
 * on a response it could not read is in its `cause`, and that is reported.
 */
export function reportableErrorOf(error: unknown): unknown {
  if (!isRequestFailure(error)) return isNetworkFailure(error) ? undefined : error;
  const { status, cause } = error as { status?: unknown; cause?: unknown };
  if (typeof status === 'number' || cause === undefined || cause === null) return undefined;
  return reportableErrorOf(cause);
}

/** What `fetch` throws when there was no answer, in each browser's words. */
const NETWORK_FAILURE = /failed to fetch|networkerror|load failed|network request failed/i;

function isNetworkFailure(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  return error instanceof TypeError && NETWORK_FAILURE.test(error.message);
}
