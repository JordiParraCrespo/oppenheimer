import { Button, cn, InboxMessageActions } from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';

/**
 * Reply here, the way a card opens what it is about in place (a bot's chat,
 * a session streamed): the toggle beside the card's link, and under them the
 * opened thing in a pane of its own height, which a swipe on the deck leaves
 * alone. Taller than the panel (a question of four options on a phone), the
 * panel scrolls, so nothing in it is cut off. With no `slot` there is nothing
 * to open, and only the link shows. The card holds `open`, since what it
 * does while open (holding the deck) is the card's.
 */
export function InboxReplyHere({
  id,
  slot,
  open,
  onOpenChange,
  labels,
  link,
  className,
}: {
  /** Ties the toggle to the pane it opens. */
  id: string;
  /** The opened thing, drawn while `open`; null when the route offers none. */
  slot: (() => ReactNode) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: { reply: string; hide: string; pane: string };
  link: ReactNode;
  /** The pane's ground and overflow: a chat scrolls itself, a session's pane does. */
  className?: string;
}) {
  return (
    <>
      <InboxMessageActions>
        {slot ? (
          <Button
            variant="secondary"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => onOpenChange(!open)}
          >
            {open ? labels.hide : labels.reply}
          </Button>
        ) : null}
        {link}
      </InboxMessageActions>
      {slot && open ? (
        <section
          id={id}
          aria-label={labels.pane}
          data-swipe-ignore
          className={cn(
            'flex h-120 max-h-[70dvh] flex-col rounded-lg border border-border-subtle',
            className,
          )}
        >
          {slot()}
        </section>
      ) : null}
    </>
  );
}
