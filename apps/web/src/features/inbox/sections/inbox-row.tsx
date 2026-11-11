import { Checkbox, InboxItem as InboxItemRow } from '@oppenheimer/design-system-web';
import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InboxRowMenu } from '@/features/inbox/components/inbox-row-menu';
import type { useInboxMarks } from '@/features/inbox/hooks/use-inbox-marks';

/**
 * One row of the list: a link that puts the item in the reading pane, and
 * its menu, whose open state the row keeps. A done row (Show done) opens
 * nothing and offers Delete alone. An open row has a checkbox for a bulk
 * action (shift-click selects the run since the last one), and Select in its
 * menu where there is no hover. The list owns the writes and the selection,
 * so one failure has one place.
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
  selected,
  selecting,
  onSelect,
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
  selected: boolean;
  selecting: boolean;
  /** `range` with shift held: the run from the last row picked. */
  onSelect: (on: boolean, range: boolean) => void;
}) {
  const { t } = useTranslation();
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
      selected={selected}
      selecting={selecting}
      select={
        done ? undefined : (
          <Checkbox
            className="size-3.5"
            checked={selected}
            onCheckedChange={(on, details) =>
              onSelect(on, details.event instanceof MouseEvent && details.event.shiftKey)
            }
            aria-label={t('inbox.selection.selectRow', { title })}
          />
        )
      }
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
          onDone={() => marks.apply('done', item)}
          onToggleLow={() => marks.apply('toggleLow', item)}
          onSnoozeHour={() => marks.apply('snoozeHour', item)}
          onSnoozeTomorrow={() => marks.apply('snoozeTomorrow', item)}
          onRemove={() => marks.apply('remove', item)}
          onSelect={() => onSelect(true, false)}
        />
      }
    />
  );
}
