import type { EditorPageSize } from '@oppenheimer/design-system-web';

/**
 * How the shell frames the screen under it. A screen is a page: the shell
 * draws the frame (`PageFrame`: a column that scrolls, a measure and a
 * gutter) at the measure the route names, and the screen renders its content
 * and nothing of the frame. The pane's value is that measure,
 * `EditorPageBody`'s `size`. A screen's bar that must stay put while its page
 * scrolls (a pull request's toolbar) goes in the shell's slot above the frame
 * (`PaneBar`), not in a frame of its own.
 *
 * `full` is only a box that is the pane and must not scroll outside itself:
 * the session terminal, which sizes itself from the pane and loses scrollback
 * to every pixel of padding.
 *
 * A route declares it as `staticData`, as an auth page declares its legal
 * note, so the shell reads it off the match instead of a screen reaching up
 * into the layout. A layout route declares it for its subtree (Plan,
 * Automations, Pull requests) and renders only its `Outlet`; a route whose
 * views are search params (a pull request's briefing, description and diff)
 * declares it as a function of its search.
 */
export type ContentPane = EditorPageSize | 'full';

type PaneDeclaration = ContentPane | ((search: Record<string, unknown>) => ContentPane);

const DEFAULT_CONTENT_PANE: ContentPane = 'narrow';

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /**
     * A page at that measure (`EditorPageBody`'s `size`: `status`,
     * `composer`, `narrow` — the default — `wide`, `board`, `fluid`), or
     * `full`, a box that is the pane. A function of the route's search when
     * its views are search params.
     */
    pane?: PaneDeclaration;
  }
}

/**
 * The innermost match that declares a pane wins, so a layout route can set one
 * for its whole subtree and a single screen can still override it.
 */
export function resolveContentPane(
  matches: readonly { staticData: { pane?: PaneDeclaration }; search?: unknown }[],
): ContentPane {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    const pane = match?.staticData.pane;
    if (typeof pane === 'function') return pane((match?.search ?? {}) as Record<string, unknown>);
    if (pane) return pane;
  }
  return DEFAULT_CONTENT_PANE;
}
