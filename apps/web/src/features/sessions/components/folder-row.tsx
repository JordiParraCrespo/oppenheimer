import { ChipSelectItem } from '@oppenheimer/design-system-web';
import { ChevronRight, Folder, GitBranch } from '@oppenheimer/design-system-web/icons';
import type { ReactNode } from 'react';

/**
 * One folder in the picker that opens it on a click: the listed folder's
 * sub-folders and the ones the search found, each with the branch of a
 * repository and the chevron that says it opens.
 */
export function FolderRow({
  path,
  branch,
  mono = false,
  onOpen,
  children,
}: {
  /** Absolute, on the host: the row's title. */
  path: string;
  branch: string | null;
  /** A path rather than a name. */
  mono?: boolean;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <ChipSelectItem
      leading={<Folder />}
      title={path}
      mono={mono}
      onClick={onOpen}
      trailing={
        <span className="flex shrink-0 items-center gap-1.5 text-fg-subtle">
          {branch ? (
            <span className="flex items-center gap-1 font-mono text-micro">
              <GitBranch className="size-3" />
              {branch}
            </span>
          ) : null}
          <ChevronRight className="size-3.5" />
        </span>
      }
    >
      {children}
    </ChipSelectItem>
  );
}
