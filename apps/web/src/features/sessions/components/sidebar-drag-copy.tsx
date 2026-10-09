import { SessionItem, SidebarProjectHeader } from '@oppenheimer/design-system-web';
import type { ComponentProps } from 'react';

/**
 * What follows the pointer while the sidebar drags: a project's header,
 * folded, or a session's row, on the sidebar's ground at the sidebar's width.
 */
export function SidebarDragCopy(
  props:
    | { kind: 'project'; name: string; count: number }
    | { kind: 'session'; name: string; state: ComponentProps<typeof SessionItem>['state'] },
) {
  return (
    <div className="w-60 rounded-sm bg-sidebar">
      {props.kind === 'project' ? (
        <SidebarProjectHeader name={props.name} count={props.count} open={false} />
      ) : (
        <SessionItem name={props.name} state={props.state} active />
      )}
    </div>
  );
}
