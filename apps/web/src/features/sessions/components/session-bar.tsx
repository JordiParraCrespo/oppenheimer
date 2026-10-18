import { cn } from '@oppenheimer/design-system-web';
import { PaneBar, SidebarToggle } from '@oppenheimer/frontend-web';

/**
 * The bar above a session, which the session routes draw themselves
 * (`bar: 'own'`): the sidebar toggle alone, as the shell's, but on the ground
 * of the pane under it. Over a live terminal that is the terminal's colour,
 * so bar and terminal read as one surface instead of a pane-grey strip above
 * a darker (in light mode, whiter) one.
 */
export function SessionBar({ ground = 'pane' }: { ground?: 'pane' | 'terminal' }) {
  return (
    <PaneBar>
      <header
        data-slot="page-bar"
        className={cn(
          'flex h-12 shrink-0 items-center pl-3.5',
          ground === 'terminal' && 'bg-term-bg',
        )}
      >
        <SidebarToggle />
      </header>
    </PaneBar>
  );
}
