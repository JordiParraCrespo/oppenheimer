import {
  SidebarEmptyRow,
  SidebarProjectGroup,
  SidebarProjectHeader,
  SortableGroup,
} from '@oppenheimer/design-system-web';
import { type ReactNode, useState } from 'react';

/**
 * A sidebar's Pinned: the rows the reader pinned, above the sidebar's own
 * groups, under an eyebrow head that folds them away. Its `SortableGroup`
 * takes `accepts` (the drag layer's kinds), so a row dropped on it is pinned
 * and its rows drag up or down it or out; the caller's `DragProvider` and
 * order hook decide what a drop means. `items` are the pinned ids in order
 * and `children` their rows; with none, `emptyHint` says where a pin can be
 * dropped. A folded group draws no rows and holds none, and a drop on it
 * still lands. `current` lights the head when the open page is one of its
 * rows, for a sidebar whose groups mark that.
 */
export function SidebarPinnedGroup({
  id,
  label,
  items,
  accepts,
  emptyHint,
  current,
  children,
}: {
  /** The `SortableGroup` key the caller's order hook knows Pinned by. */
  id: string;
  label: string;
  items: readonly string[];
  /** The drag kinds a drop may bring; `[]` while a search holds the rows still. */
  accepts: readonly string[];
  emptyHint: ReactNode;
  current?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <SidebarProjectGroup>
      <SortableGroup
        id={id}
        items={open ? items : []}
        accepts={accepts}
        data={{ label }}
        className="flex flex-col"
      >
        <SidebarProjectHeader
          tone="eyebrow"
          name={label}
          // The drop hint below says it holds none; a 0 beside it adds nothing.
          count={items.length || undefined}
          open={open}
          onOpenChange={setOpen}
          current={current}
        />
        {!open ? null : items.length === 0 ? (
          <SidebarEmptyRow>{emptyHint}</SidebarEmptyRow>
        ) : (
          children
        )}
      </SortableGroup>
    </SidebarProjectGroup>
  );
}
