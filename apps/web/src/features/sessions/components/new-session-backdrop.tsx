import { cn } from '@oppenheimer/design-system-web';

/**
 * The reader's image behind New session, fading into the pane's grey at the
 * foot so the heading over it keeps its contrast. The pane is its
 * positioning box and its stacking context (`AppShell`), so it stays put
 * while the page scrolls and sits under everything else the pane draws.
 *
 * Under the whole pane (`under="pane"`, no tabs open) it runs to the top and
 * says so (`data-pane-backdrop`), so the bar's toggle and the image's button
 * stand on frosted chips over it. Under the content (`under="content"`, a
 * bar of tabs over it) it starts at the bar's foot and the bar keeps the
 * pane's own ground.
 */
export function NewSessionBackdrop({ image, under }: { image: string; under: 'pane' | 'content' }) {
  return (
    <div
      data-pane-backdrop={under === 'pane' ? '' : undefined}
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 -z-10',
        under === 'pane' ? 'top-0' : 'top-(--tab-bar-h)',
      )}
    >
      <img src={image} alt="" className="size-full object-cover" />
      <div className="scrim-fade absolute inset-x-0 bottom-0 h-3/4" />
    </div>
  );
}
