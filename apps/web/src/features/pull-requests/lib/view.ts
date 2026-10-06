import type { StatusState } from '@oppenheimer/design-system-web';
import type {
  AnalyticsFigure,
  AnalyticsMedian,
  PullRequestChecks,
} from '@oppenheimer/frontend-consumer';

/** How the queue writes a wait: `1d 3h`, `18h 24m`, `36m`. */
export function formatWait(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`;
  return `${minutes}m`;
}

/** A median in hours, written like a wait; an em dash when nothing was measured. */
export function formatHours(hours: number | null): string {
  return hours === null ? '—' : formatWait(Math.round(hours * 3600));
}

/** Over twelve hours is late: the queue says so in the row. */
export const LATE_SECONDS = 12 * 3600;

export const CHECK_STATE: Record<PullRequestChecks, StatusState> = {
  passing: 'passing',
  failing: 'blocked',
  running: 'waiting',
  none: 'idle',
  unavailable: 'idle',
};

export type DeltaTone = 'good' | 'bad' | 'flat';

/**
 * The change from the period before, as a percentage, and whether it is good:
 * more created or merged is good, a longer wait is not.
 */
export function deltaOf(
  figure: AnalyticsFigure | AnalyticsMedian,
  higherIsBetter: boolean,
): { value: string; tone: DeltaTone } | null {
  if (figure.value === null || figure.previous === null || figure.previous === 0) return null;
  const change = Math.round(((figure.value - figure.previous) / figure.previous) * 100);
  if (change === 0) return { value: '0%', tone: 'flat' };
  const better = higherIsBetter ? change > 0 : change < 0;
  return { value: `${change > 0 ? '+' : '−'}${Math.abs(change)}%`, tone: better ? 'good' : 'bad' };
}

/** `apps/` and `web/` → `apps/, web/`: the folders a briefing names, at most three. */
export function folderList(folders: readonly string[]): string {
  return folders.slice(0, 3).join(', ');
}

/** GitHub's hunks for one file, under the headers a patch reader needs to know which file they are. */
export function patchOf(file: {
  path: string;
  previousPath: string | null;
  patch: string;
}): string {
  const before = file.previousPath ?? file.path;
  return `diff --git a/${before} b/${file.path}\n--- a/${before}\n+++ b/${file.path}\n${file.patch}`;
}
