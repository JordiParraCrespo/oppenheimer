import { SidebarProjectHeader } from '@oppenheimer/design-system-web';

/** The head a group drag lifts in Employees: its name as the eyebrow, folded, at the sidebar's width. */
export function BotGroupDragOverlay({ name }: { name: string }) {
  return (
    <div className="w-60 rounded-nav bg-sidebar">
      <SidebarProjectHeader tone="eyebrow" name={name} open={false} />
    </div>
  );
}
