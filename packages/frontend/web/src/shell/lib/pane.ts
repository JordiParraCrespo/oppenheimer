/**
 * How the shell frames the screen under it. A settings pane is prose and reads
 * best in a measured column; the console's terminal *is* the viewport, and
 * every pixel of padding is scrollback taken away.
 *
 * A screen declares it as route `staticData`, as an auth page declares its
 * legal note, so the shell reads it off the match instead of a screen reaching
 * up into the layout.
 */
export type ContentPane = 'measure' | 'full';

const DEFAULT_CONTENT_PANE: ContentPane = 'measure';

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /**
     * `measure` (the default) — the padded 1080px reading column.
     * `full` — the screen owns the pane: no padding, no measure, no scroll of
     * the shell's, because the screen brings its own (the session terminal).
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
