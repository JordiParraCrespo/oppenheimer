import { type DragItem, SessionItem, SidebarProjectHeader } from '@oppenheimer/design-system-web';
import type { ComponentProps } from 'react';

type SessionState = NonNullable<ComponentProps<typeof SessionItem>['state']>;

/**
 * What follows the pointer while the sidebar drags, drawn from the drag
 * alone: a project's header, folded, or a session's row, on the sidebar's
 * ground at the sidebar's width.
 */
export function SidebarDragCopy({ item }: { item: DragItem }) {
  const name = item.data.label ?? item.id;
  return (
    <div className="w-60 rounded-sm bg-sidebar">
      {item.data.type === 'project' ? (
        <SidebarProjectHeader name={name} open={false} />
      ) : (
        <SessionItem name={name} state={item.data.state as SessionState | undefined} active />
      )}
    </div>
  );
}
