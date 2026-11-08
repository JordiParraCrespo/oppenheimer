/** An eased ramp of the pane's ground, opaque at the foot: (alpha, position %). */
const FADE_STOPS = [
  [1, 0],
  [0.987, 8],
  [0.951, 15],
  [0.896, 22],
  [0.825, 29],
  [0.741, 36],
  [0.648, 43],
  [0.55, 50],
  [0.45, 57],
  [0.352, 64],
  [0.259, 71],
  [0.175, 78],
  [0.104, 85],
  [0.049, 91],
  [0.013, 96],
  [0, 100],
] as const;

const FADE = `linear-gradient(to top, ${FADE_STOPS.map(
  ([alpha, at]) => `color-mix(in srgb, var(--canvas-recessed) ${alpha * 100}%, transparent) ${at}%`,
).join(', ')})`;

/**
 * The reader's image behind New session: it covers the whole pane, under the
 * page bar and the composer, and fades into the pane's grey at the foot so
 * the heading over it keeps its contrast. The pane is its positioning box and
 * its stacking context (`AppShell`), so it stays put while the page scrolls
 * and sits under everything else the pane draws.
 *
 * The fade follows an eased curve rather than a straight ramp with one
 * midpoint, which drew a visible band where the slope changed; in light the
 * band read as a hard white edge.
 *
 * `data-pane-backdrop` tells the pane an image is under it, so the page bar's
 * quiet icons stand on a frosted chip of their own (`AppShell`, and the image
 * button beside it) rather than straight on the photo.
 */
export function NewSessionBackdrop({ image }: { image: string }) {
  return (
    <div data-pane-backdrop aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <img src={image} alt="" className="size-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 h-3/4" style={{ backgroundImage: FADE }} />
    </div>
  );
}
