import { searchFlag } from '@oppenheimer/frontend-web';

/**
 * The first-run walk, as a fact the URL carries. Onboarding is shown once
 * (`05-screens.md`) and Ready enforces it: it is the one page under
 * `/onboarding` meaningless to a finished account, while Connect GitHub and
 * Add host stay reachable because New session links at them.
 *
 * Ready cannot read *when* off the account: the address is claimed by the end
 * of step 2, so a legitimate arrival looks as finished as one a week later.
 * The visit is the missing fact, and like `installation` and `host` it lives
 * on the query string, cheaper than a first-run store to keep in sync. `walk`
 * is minted when step 2's claim lands (the only thing that opens a walk) and
 * carried by the flow's own links; a reader New session sent here has none,
 * so Continue returns to the console. It dies with the URLs, leaving nothing
 * for a logout, a second tab or the next account to inherit.
 *
 * As a search param it is on or absent: the router parses `?walk=true` into a
 * boolean, but a re-serialised or hand-typed URL can hand over the string, so
 * both read as on.
 */
export const walkParam = searchFlag;

/**
 * The echoed `state` read for the walk: `walk` from its prefix, and the prefix
 * taken off what is left, so the callback's schema sees the nonce the API
 * minted. For a route's `z.preprocess`.
 */
export function walkFromState(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const search = raw as Record<string, unknown>;
  return isWalkState(search.state)
    ? { ...search, walk: true, state: stateWithoutWalk(search.state) }
    : search;
}

/**
 * How the walk crosses GitHub. The install returns to `/onboarding/github`
 * with the query *GitHub* chose, so a `walk` in the URL does not survive, and a
 * reader who installs the App mid-walk would be turned away from Ready.
 * `state` is the one value GitHub echoes untouched, and also the API's
 * single-use nonce, so the walk rides as its prefix, `first-run.<nonce>`, and
 * the GitHub route strips it before the nonce is used.
 */
const WALK_STATE = 'first-run';

/** The prefix a walk puts in front of the nonce; a nonce is base64url, so never a `.`. */
const WALK_PREFIX = `${WALK_STATE}.`;

/**
 * Whether the `state` GitHub echoed says this visit is the first-run walk.
 *
 * The bare `first-run` is still read, for an install started before the state
 * became a nonce: it keeps the walk, and — carrying no nonce — posts nothing.
 */
export function isWalkState(raw: unknown): boolean {
  return typeof raw === 'string' && (raw === WALK_STATE || raw.startsWith(WALK_PREFIX));
}

export function stateWithoutWalk(raw: unknown): unknown {
  return typeof raw === 'string' && raw.startsWith(WALK_PREFIX)
    ? raw.slice(WALK_PREFIX.length)
    : raw;
}

/**
 * The install URL the API minted, with the walk pinned where GitHub will
 * return it: its `state` prefixed. `URL` rather than string concatenation,
 * because the address may already have a query — and one it cannot parse, or
 * one with no state, is handed back untouched: losing the walk costs the
 * reader the landing, throwing here would cost them the step.
 */
export function installUrlCarryingWalk(installUrl: string): string {
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
