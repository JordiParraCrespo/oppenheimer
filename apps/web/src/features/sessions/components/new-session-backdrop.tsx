/**
 * The reader's image behind New session: it covers the whole pane, under the
 * page bar and the composer, and fades into the pane's grey at the foot so
 * the heading over it keeps its contrast. The pane is its positioning box and
 * its stacking context (`AppShell`), so it stays put while the page scrolls
 * and sits under everything else the pane draws.
 *
 * At the head the pane's grey stays solid behind the page bar and only then
 * fades: the bar's quiet icons (the sidebar toggle, the image button) sit on
 * the ground they are drawn for, whatever the image is. A translucent wash
 * there helped over a bright photo and hurt over a dark one.
 */
export function NewSessionBackdrop({ image }: { image: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <img src={image} alt="" className="size-full object-cover" />
      <div className="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-canvas-recessed from-45% to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-canvas-recessed via-canvas-recessed/70 to-transparent" />
    </div>
  );
}
