/**
 * The tones a data mark may wear (a bar, a segment, a dot beside a figure):
 * the categorical chart order, the three state hues for a figure that is a
 * state (additions, deletions, a passing check), and muted. One union for
 * the charts, the share bar and the fact tiles, so a series is named one
 * way everywhere.
 */
type DataTone = 'chart-1' | 'chart-2' | 'chart-3' | 'chart-4' | 'chart-5' | 'success' | 'danger' | 'warning' | 'muted';

const TONE_BG: Record<DataTone, string> = {
  'chart-1': 'bg-chart-1',
  'chart-2': 'bg-chart-2',
  'chart-3': 'bg-chart-3',
  'chart-4': 'bg-chart-4',
  'chart-5': 'bg-chart-5',
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
  muted: 'bg-fg-subtle',
};

const TONE_STROKE: Record<DataTone, string> = {
  'chart-1': 'var(--chart-1)',
  'chart-2': 'var(--chart-2)',
  'chart-3': 'var(--chart-3)',
  'chart-4': 'var(--chart-4)',
  'chart-5': 'var(--chart-5)',
  success: 'var(--success)',
  danger: 'var(--danger)',
  warning: 'var(--warning)',
  muted: 'var(--fg-subtle)',
};

export { TONE_BG, TONE_STROKE };
export type { DataTone };
