/**
 * The first-run walk, as a fact the URL carries.
 *
 * Onboarding is shown once (`05-screens.md`), and Ready is the step that
 * enforces it: the workspace step already returns a claimed address to the
 * console, and Connect GitHub and Add host stay reachable for good because New
 * session links at them. Ready is the one page under `/onboarding` that means
 * nothing to a finished account — "You're all set" over a walk it took days
 * ago.
 *
 * What Ready cannot read off the account is *when*. The address is claimed by
 * the end of step 2, so a legitimate arrival looks exactly as finished as one
 * coming back a week later. The missing fact is the visit, and `ready.tsx`
 * already decided where a visit's facts live: on the query string, beside
 * `installation` and `host`, because the summary is a page someone can reload
 * and two ids are cheaper than a first-run store to keep in sync. `walk` is
 * the third such fact.
 *
 * It is minted by step 2's claim, the only thing that opens a walk, and
 * carried by the flow's own links. A reader New session sent here to pair a
 * second machine has no `walk`, so Continue takes them back to the console
 * rather than to a landing that congratulates them on first-run. Nothing has
 * to be cleaned up afterwards: the fact lives and dies with the URLs that
 * carry it, so there is no bit for a logout, a second tab or the next account
 * to inherit.
 */
export interface FirstRunWalk {
  /** Present only on a navigation that is the walk itself. */
  walk?: true;
}

/**
 * Read the walk off a router search object.
 *
 * Both shapes are accepted because the router parses `?walk=true` into a
 * boolean while a re-serialised or hand-typed URL can still hand over the
 * string, and a guard that answered differently to the two would be a guard
 * nobody can reason about.
 */
export function parseWalk(search: Record<string, unknown>): FirstRunWalk {
  return search.walk === true || search.walk === 'true' ? { walk: true } : {};
}

/**
 * How the walk crosses GitHub.
 *
 * Connect GitHub leaves the app: the browser goes to github.com and comes back
 * to `/onboarding/github` with the query *GitHub* chose, so a `walk` handed to
 * the install page is not in the URL that returns. `state` is the one value
 * GitHub echoes back untouched, which is what it is for. Without this, a
 * reader who actually installs the App mid-walk loses the walk on the return
 * leg and is turned away from Ready two clicks later.
 *
 * `state` is also the API's single-use nonce, which is its real job, so the
 * walk rides as a prefix of it: `first-run.<nonce>` (`github-install.ts`).
 */
export const WALK_STATE = 'first-run';
