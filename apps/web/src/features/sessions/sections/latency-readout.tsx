import { useLatencyReadout } from '../hooks/use-latency-readout';

/**
 * The terminal's echo readout (`latency-readout.ts`), when it is switched on:
 * in the session's bar, or on the status line of a pane that has no bar.
 */
export function LatencyReadout({ sessionId }: { sessionId: string }) {
  const latency = useLatencyReadout(sessionId);
  if (!latency) return null;
  return (
    <span
      aria-hidden="true"
      data-testid="terminal-latency"
      className="shrink-0 truncate font-mono text-xs text-fg-muted tabular-nums"
    >
      {latency}
    </span>
  );
}
