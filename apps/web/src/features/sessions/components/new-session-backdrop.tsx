/**
 * The reader's image behind New session: it covers the pane's content under
 * the bar, from the bar's foot down (`--tab-bar-h`), so the bar keeps the
 * pane's own ground, and fades into the pane's grey at the foot so the
 * heading over it keeps its contrast. The pane is its positioning box and
 * its stacking context (`AppShell`), so it stays put while the page scrolls
 * and sits under everything else the pane draws.
 */
export function NewSessionBackdrop({ image }: { image: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-(--tab-bar-h) bottom-0 -z-10"
    >
      <img src={image} alt="" className="size-full object-cover" />
      <div className="scrim-fade absolute inset-x-0 bottom-0 h-3/4" />
    </div>
  );
}
