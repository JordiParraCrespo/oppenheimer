/** Where a dragged card will land: its own height, ringed. */
export function DropPlaceholder() {
  return (
    <div aria-hidden className="h-14 rounded-md bg-selected-surface ring-1 ring-ring ring-inset" />
  );
}
