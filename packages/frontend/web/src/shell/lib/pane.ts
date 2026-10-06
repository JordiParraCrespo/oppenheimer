import type { EditorPageSize } from '@oppenheimer/design-system-web';

/**
 * How the shell frames the screen under it. A screen is a page: the shell
 * draws the frame (`PageFrame`: a column that scrolls, a measure and a
 * gutter) at the measure the route names, and the screen renders its content
 * and nothing of the frame. The pane's value is that measure,
 * `EditorPageBody`'s `size`.
 *
 * `full` is only for a box that is the pane and must not scroll outside
 * itself: the session terminal, which sizes itself from the pane and loses
 * scrollback to every pixel of padding, and a pull request, whose bar stays
 * put over its diff. A state of such a screen that is a page (a session still
 * being prepared, a pull request's briefing) asks for `PageFrame` rather than
 * rebuild it.
 *
 * A route declares it as `staticData`, as an auth page declares its legal
 * note, so the shell reads it off the match instead of a screen reaching up
 * into the layout. A layout route declares it for its subtree (Plan,
 * Automations, Pull requests) and renders only its `Outlet`.
 */
export type ContentPane = EditorPageSize | 'full';

const DEFAULT_CONTENT_PANE: ContentPane = 'narrow';

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /**
     * A page at that measure (`EditorPageBody`'s `size`: `status`,
     * `composer`, `narrow` — the default — `wide`, `briefing`, `board`), or
     * `full`, a box that is the pane: no frame of the shell's, only its
     * ground.
     */
    pane?: ContentPane;
  }
}

/**
 * The innermost match that declares a pane wins, so a layout route can set one
 * for its whole subtree and a single screen can still override it.
 */
export function resolveContentPane(
  matches: readonly { staticData: { pane?: ContentPane } }[],
): ContentPane {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const pane = matches[index]?.staticData.pane;
    if (pane) return pane;
  }
  return DEFAULT_CONTENT_PANE;
}
