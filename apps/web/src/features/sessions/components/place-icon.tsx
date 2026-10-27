import { Cloud, Folder, GitBranch } from '@oppenheimer/design-system-web/icons';
import type { SessionPlace } from '@oppenheimer/shared/schemas/session';

/** Where a session runs, as a mark: a branch for a new worktree, a folder, or a cloud. */
export function PlaceIcon({ place }: { place: SessionPlace }) {
  if (place === 'folder') return <Folder />;
  if (place === 'cloud') return <Cloud />;
  return <GitBranch />;
}
