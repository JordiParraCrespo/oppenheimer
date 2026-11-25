/** What a scroll event says of where the reader is, as React Native reports it. */
export interface ScrollPlace {
  contentOffset: { y: number };
  contentSize: { height: number };
  layoutMeasurement: { height: number };
}

/**
 * How far above the foot still counts as at it: about two lines, so a reader
 * who is at the end and nudges the list, or lands a few points short after a
 * fling, is still followed.
 */
export const FOLLOW_SLACK = 48;

/**
 * Whether a list that grows at its foot should keep following it: only while
 * the reader is at the foot, or within {@link FOLLOW_SLACK} of it. Content
 * shorter than the view is always at its foot, and so is a bounce past it.
 */
export function atFoot(
  { contentOffset, contentSize, layoutMeasurement }: ScrollPlace,
  slack = FOLLOW_SLACK,
): boolean {
  return contentSize.height - (contentOffset.y + layoutMeasurement.height) <= slack;
}
