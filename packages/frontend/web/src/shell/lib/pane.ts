import type { EditorPageSize } from '@oppenheimer/design-system-web';

/**
 * How the shell frames the screen under it. Almost every screen is a page:
 * the canvas ground, a column that scrolls, a measure and a gutter, which
 * the shell draws once (the design system's `EditorPage`) so no screen
 * repaints the ground — the export's grey, the same under every pane — or
 * keeps a scroll of its own. The pane's value is the
 * page's measure. The one exception is a screen whose box *is* the pane —
 * the session terminal, which sizes itself from it and loses scrollback to
 * every pixel of padding, and New session, whose drop outline traces it.
 *
 * A route declares it as `staticData`, as an auth page declares its legal
 * note, so the shell reads it off the match instead of a screen reaching up
 * into the layout. A layout route declares it for its subtree (Plan,
 * Automations) and renders only its `Outlet`.
 */
export type ContentPane = EditorPageSize | 'full';

const DEFAULT_CONTENT_PANE: ContentPane = 'narrow';

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /**
     * `narrow` (the default), `wide` or `board` — a page at that measure
     * (`EditorPageBody`'s `size`). `full` — the screen owns the pane: no
     * padding, measure or scroll of the shell's, on the shell's ground.
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
