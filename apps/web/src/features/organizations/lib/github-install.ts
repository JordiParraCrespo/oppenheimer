import { WALK_STATE } from '@/features/organizations/lib/first-run';

/** What GitHub appends to the callback once someone has installed the App. */
export interface GithubInstallCallback {
  /** GitHub's own installation id, for the connect body. */
  installation_id?: number;
  /** The one-shot OAuth code that proves the caller can see that installation. */
  code?: string;
  /** `install` or `update`; GitHub sends it on both paths. */
  setup_action?: string;
  /**
   * The install state the API minted, **nonce only**: the walk prefix is
   * stripped here, so what the connect call posts is exactly what was minted.
   * Absent when the redirect carried none, or one this console never sends.
   */
  state?: string;
}

/** The API's nonce: base64url, 16–128 characters, so never a `.`. */
const STATE_NONCE = /^[A-Za-z0-9_-]{16,128}$/;

/**
 * The prefix a walk puts in front of the nonce. The walk is a UX fact with no
 * security value, so it rides beside the state rather than in a second
 * parameter GitHub would drop.
 */
const WALK_PREFIX = `${WALK_STATE}.`;

/**
 * Read the callback off a router search object.
 *
 * `installation_id` arrives as a string in the URL and is a number on the
 * wire, so it is parsed here rather than at the call site — a `NaN` reaching
 * the API would be a 400 the screen could not explain.
 *
 * `state` is whatever GitHub echoed. A walk arrives as `first-run.<nonce>`;
 * anything that is not a nonce once that prefix is off — the legacy bare
 * `first-run`, junk, a forwarded link with none — becomes `undefined`, and the
 * step then refuses to post rather than letting the API say so.
 */
export function parseInstallCallback(search: Record<string, unknown>): GithubInstallCallback {
  const rawId = search.installation_id;
  const id = typeof rawId === 'string' ? Number.parseInt(rawId, 10) : Number(rawId);

  return {
    installation_id: Number.isFinite(id) && id > 0 ? id : undefined,
    code: typeof search.code === 'string' && search.code ? search.code : undefined,
    setup_action: typeof search.setup_action === 'string' ? search.setup_action : undefined,
    state: parseStateNonce(search.state),
  };
}

function parseStateNonce(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const nonce = raw.startsWith(WALK_PREFIX) ? raw.slice(WALK_PREFIX.length) : raw;
  return STATE_NONCE.test(nonce) ? nonce : undefined;
}

/**
 * Whether the `state` GitHub echoed says this visit is the first-run walk.
 *
 * The bare `first-run` is still read, for an install started before the state
 * became a nonce: it keeps the walk, and — carrying no nonce — posts nothing.
 */
export function isWalkState(raw: unknown): boolean {
  return typeof raw === 'string' && (raw === WALK_STATE || raw.startsWith(WALK_PREFIX));
}

/**
 * The install URL the API minted, with the walk pinned where GitHub will
 * return it.
 *
 * Where the browser goes is the API's answer to `POST
 * /installations/install-state`, which already carries `state=<nonce>`; a walk
 * only prefixes it. `URL` rather than string concatenation, because the address
 * may already have a query — and one it cannot parse is handed back untouched:
 * losing the walk costs the reader the landing, throwing here would cost them
 * the step.
 */
export function installUrlWithState(installUrl: string, walk?: true): string {
  if (!walk) return installUrl;
  try {
    const url = new URL(installUrl);
    const state = url.searchParams.get('state');
    if (!state) return installUrl;
    url.searchParams.set('state', `${WALK_PREFIX}${state}`);
    return url.toString();
  } catch {
    return installUrl;
  }
}
