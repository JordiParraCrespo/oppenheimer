import { useElapsed } from '../hooks/use-elapsed';

/**
 * The provisioning pane's clock, as its own leaf.
 *
 * The one-second tick lives here and nowhere above: the pane hands this to the
 * `Stepper`'s `elapsed` slot as an element, so a tick re-renders this text and
 * not the pane, its steps, or the three reads behind them.
 */
export function ElapsedClock({ since, ticking }: { since: Date; ticking: boolean }) {
  return <>{useElapsed(since, ticking)}</>;
}
