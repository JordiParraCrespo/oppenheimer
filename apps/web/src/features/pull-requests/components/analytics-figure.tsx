import { StatDelta } from '@oppenheimer/design-system-web';
import type { DeltaTone } from '../lib/view';

/** A figure's change from the period before, and what it was then. */
export function AnalyticsDelta({
  delta,
  previous,
}: {
  delta: { value: string; tone: DeltaTone } | null;
  previous: string;
}) {
  if (!delta) return <span className="text-xs text-fg-muted">{previous}</span>;
  return (
    <StatDelta value={delta.value} tone={delta.tone}>
      {previous}
    </StatDelta>
  );
}
