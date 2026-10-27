import { InboxItem as InboxItemRow } from '@oppenheimer/design-system-web';
import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { InboxKindIcon } from '@/features/inbox/components/inbox-kind-icon';
import { InboxRowMenu } from '@/features/inbox/components/inbox-row-menu';
import type { useInboxMarks } from '@/features/inbox/hooks/use-inbox-marks';

/**
 * One row of the list: a link that puts the item in the pane, and its menu,
 * whose open state the row keeps. A done row (Show done) opens nothing and
 * offers Delete alone. The list owns the writes, so one failure has one place.
 */
export function InboxRow({
  item,
  title,
  from,
  meta,
  active,
  done,
  marks,
}: {
  item: InboxItem;
  title: string;
  from: string;
  meta: string;
  active: boolean;
  done: boolean;
  marks: ReturnType<typeof useInboxMarks>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <InboxItemRow
      icon={<InboxKindIcon kind={item.kind} />}
      title={title}
      from={from}
      meta={meta}
      active={active}
      done={done}
      menuOpen={menuOpen}
      render={
        done ? undefined : (
          <Link to="/inbox" search={(previous) => ({ ...previous, item: item.key })} />
        )
      }
      action={
        <InboxRowMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          done={done}
          low={item.low}
          keys={active}
          onDone={() => marks.done(item, title)}
          onToggleLow={() => marks.toggleLow(item)}
          onSnoozeHour={() => marks.snoozeHour(item)}
          onSnoozeTomorrow={() => marks.snoozeTomorrow(item)}
          onRemove={() => marks.remove(item)}
        />
      }
    />
  );
}
