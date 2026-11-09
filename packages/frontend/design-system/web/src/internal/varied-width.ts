/**
 * The width a placeholder bar takes for row `index`: the component's own
 * list, walked in order and wrapped, so a loading list reads as lines of
 * text rather than a striped table, and the same row draws the same width on
 * every render (a screenshot, a remount). The widths stay the component's;
 * only the pick is shared.
 */
export function variedWidth<T>(index: number, widths: readonly T[]): T {
  return widths[index % widths.length];
}
