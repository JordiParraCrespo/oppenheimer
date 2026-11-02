/**
 * Whether a failure the frontend saw is ours to report. A request the server
 * answered carries its status (or a repository's code): a 4xx is the reader's
 * or the API's refusal, and a 5xx the API reports itself, with the stack the
 * browser never sees. A request that got no answer is the network's. What is
 * left is a bug in this code: a render throw, a response that did not parse,
 * a `TypeError` in a hook.
 */
export function isReportableError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const { status, code } = error as { status?: unknown; code?: unknown };
    if (typeof status === 'number') return false;
    if (typeof code === 'string' && code !== '') return false;
  }
  return !isNetworkFailure(error);
}

/** What `fetch` throws when there was no answer, in each browser's words. */
const NETWORK_FAILURE = /failed to fetch|networkerror|load failed|network request failed/i;

function isNetworkFailure(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  return error instanceof TypeError && NETWORK_FAILURE.test(error.message);
}
