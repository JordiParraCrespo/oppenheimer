import { InboxItem as InboxItemRow } from '@oppenheimer/design-system-web';
import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { InboxRowMenu } from '@/features/inbox/components/inbox-row-menu';
import type { useInboxMarks } from '@/features/inbox/hooks/use-inbox-marks';

/**
 * One row of the list: a link that puts the item in the reading pane, and
 * its menu, whose open state the row keeps. A done row (Show done) opens
 * nothing and offers Delete alone. The list owns the writes, so one failure
 * has one place.
 */
export function InboxRow({
  item,
  sender,
  title,
  preview,
  meta,
  unread,
  active,
  done,
  marks,
}: {
  item: InboxItem;
  sender: string;
  title: string;
  preview: string;
  meta: string;
  unread: boolean;
  active: boolean;
  done: boolean;
  marks: ReturnType<typeof useInboxMarks>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <InboxItemRow
      sender={sender}
      title={title}
      preview={preview}
      meta={meta}
      unread={unread}
      active={active}
      done={done}
      menuOpen={menuOpen}
      render={
        done ? undefined : (
          <Link to="/plan/inbox" search={(previous) => ({ ...previous, item: item.key })} />
        )
      }
      action={
        <InboxRowMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          done={done}
          low={item.low}
          keys={active}
          onDone={() => marks.done(item)}
          onToggleLow={() => marks.toggleLow(item)}
          onSnoozeHour={() => marks.snoozeHour(item)}
          onSnoozeTomorrow={() => marks.snoozeTomorrow(item)}
          onRemove={() => marks.remove(item)}
        />
      }
    />
  );
}
