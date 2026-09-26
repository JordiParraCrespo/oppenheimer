/**
 * Which frame a route sits in.
 *
 * The console's frame is the rail and the session list beside the pane. The
 * Settings pages replace that whole left side with their own nav and a
 * "Back to console" row (`design/version1/Settings.dc.html`), so a route says
 * `frame: 'own'` and the app's authenticated layout mounts it without
 * `AppShell`, keeping only its guards. The pane (`measure` or `full`,
 * `pane.ts`) is a different question: how the content column is shaped
 * inside the shell.
 */
export type RouteFrame = 'console' | 'own';

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** `console` (the default) — the rail and the session list. `own` — the route draws its frame. */
    frame?: RouteFrame;
  }
}

/** Whether any match on the way down asked for its own frame. */
export function drawsOwnFrame(matches: readonly { staticData: { frame?: RouteFrame } }[]): boolean {
  return matches.some((match) => match.staticData.frame === 'own');
}
