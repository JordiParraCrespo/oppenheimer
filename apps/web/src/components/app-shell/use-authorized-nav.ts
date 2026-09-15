import { NAV, type NavItem, SETTINGS_NAV } from '@/components/app-shell/nav';

/**
 * The nav rows the signed-in user may actually reach, in order. A row is shown
 * only when their ability satisfies **every** policy it declares — the same
 * AND the API's `PoliciesGuard` applies — so the sidebar and command palette
 * never offer a destination that would answer with a 403.
 *
 * While permissions are still loading we show only the always-visible rows
 * (Settings) so a gated route never flashes in and then disappears. The
 * permissions query is cached across loads, so on every visit after the first
 * there is nothing to wait for.
 *
 * When that query has *failed*, every row is shown instead. Hiding the product
 * because a side request fell over would be its own lie — we do not know what
 * this reader may open, and the guards, which are the real gate, still do.
 */
export function useAuthorizedNav(): NavItem[] {
  return [...NAV, SETTINGS_NAV];
}

/**
 * Where to send someone when the product, not the reader, picks the screen —
 * or `null` when there is nowhere honest to send them.
 *
 * The first `NAV` row the reader's ability reaches. The dashboard declares no
 * policy (it reads only the caller's own profile), so today this is always the
 * dashboard once permissions are known; the hook exists so a gated first row
 * added later never lands a reader on a screen that answers 403.
 *
 * Settings is deliberately not a fallback: `null` says no destination is
 * better than the one we are on, and the caller keeps its own honest error on
 * screen rather than bouncing the reader between two of them.
 */
export function useLandingRoute(): (typeof NAV)[number]['to'] | null {
  return NAV[0]?.to ?? null;
}
