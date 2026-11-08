/**
 * The reader's image behind New session: it covers the whole pane, under the
 * page bar and the composer, and fades into the pane's grey at the foot so
 * the heading over it keeps its contrast. The pane is its positioning box and
 * its stacking context (`AppShell`), so it stays put while the page scrolls
 * and sits under everything else the pane draws.
 *
 * `data-pane-backdrop` tells the pane an image is under it, so the page bar's
 * quiet icons stand on a frosted chip of their own (`AppShell`, and the image
 * button beside it) rather than straight on the photo.
 */
export function NewSessionBackdrop({ image }: { image: string }) {
  return (
    <div data-pane-backdrop aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <img src={image} alt="" className="size-full object-cover" />
      <div className="scrim-fade absolute inset-x-0 bottom-0 h-3/4" />
    </div>
  );
}
