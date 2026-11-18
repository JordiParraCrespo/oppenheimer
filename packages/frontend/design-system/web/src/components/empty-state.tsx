import { EmptyArt, type EmptyArtName } from '../internal/empty-art';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../internal/empty';

/**
 * The drawing over an illustrated empty state, from the one set in
 * `internal/empty-art` (decorative: the title says what it means).
 */
function EmptyStateArt({ name, className }: { name: EmptyArtName; className?: string }) {
  return (
    <EmptyMedia variant="illustration" className={className}>
      <EmptyArt name={name} />
    </EmptyMedia>
  );
}

/**
 * "Nothing here", in one of three tiers, picked by where it stands:
 *
 * - **Illustrated**: a screen's or a pane's main region is empty the first
 *   time, or is through ("You're all caught up"). `EmptyState.Art`, a title,
 *   one line on what will appear and how, and the one action that starts it.
 *   Only here; never in Settings, a card's section, a sidebar or a menu.
 * - **Icon**: a state of a pane or a section that is not a first run (a
 *   session that closed, filters that match nothing, an account not yet
 *   connected in Settings). A 44px `Media variant="icon"` disc, a title, a
 *   line, at most one primary action.
 * - **Inline**: inside a sidebar, a list row, a picker or a panel. One muted
 *   line, no media: `compact` here, or the container's own empty row
 *   (`SidebarEmptyRow`, `RunsListEmpty`, `SettingsListRow muted`,
 *   `ProjectPanelEmpty`, `ChipSelectEmpty`).
 *
 * @example
 * ```tsx
 * <EmptyState>
 *   <EmptyState.Header>
 *     <EmptyState.Art name="projects" />
 *     <EmptyState.Title>No projects yet</EmptyState.Title>
 *     <EmptyState.Description>A project groups your sessions.</EmptyState.Description>
 *   </EmptyState.Header>
 *   <EmptyState.Content>
 *     <Button>New project</Button>
 *   </EmptyState.Content>
 * </EmptyState>
 * ```
 */
const EmptyState = Object.assign(Empty, {
  Art: EmptyStateArt,
  Content: EmptyContent,
  Description: EmptyDescription,
  Header: EmptyHeader,
  Media: EmptyMedia,
  Title: EmptyTitle,
});

export { EmptyState };
export type { EmptyArtName };
