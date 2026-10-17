import type { HostFolderEntry, HostFolders } from '@oppenheimer/frontend-consumer';
import { crumbsOf, HOME, parentOf, parseFolderInput, shortenPath } from './folder-path';

/**
 * What New session's folder picker shows for what has been typed and what the
 * host answered (`product/versions/mvp/24-session-places.md` §4): the folder
 * listed, the rows the typed start of a name leaves, why there are none, and
 * the one folder **Use** would open — only a folder the host said exists.
 */
export interface FolderView {
  /** The folder listed, as shown (`~/code`). */
  dir: string;
  /** The start of a name typed after it. */
  fragment: string;
  crumbs: { name: string; dir: string }[];
  /** Where the up row goes; null at the root. */
  up: string | null;
  rows: HostFolderEntry[];
  /** Why there are no rows: no such folder, nothing starts so, or none at all. */
  empty: 'missing' | 'filtered' | 'none' | null;
  /** The folder Use opens, absolute, and its branch when it is a repository; null while none exists. */
  target: { path: string; branch: string | null } | null;
  /** The recent folders belong at the start: home, nothing typed after it. */
  showRecent: boolean;
}

export function folderView({
  input,
  home,
  listing,
  missing,
}: {
  input: string;
  home: string | null;
  /** The listing of the folder typed, once the host answered. */
  listing: HostFolders | undefined;
  /** The host said that folder does not exist, or is not a folder. */
  missing: boolean;
}): FolderView {
  const { dir, fragment } = parseFolderInput(input);
  const prefix = fragment.toLowerCase();
  const rows = missing
    ? []
    : (listing?.entries ?? []).filter((entry) => entry.name.toLowerCase().startsWith(prefix));
  const exact = fragment ? listing?.entries.find((entry) => entry.name === fragment) : undefined;
  const target = missing
    ? null
    : fragment
      ? exact
        ? { path: exact.path, branch: exact.branch }
        : null
      : listing
        ? { path: listing.path, branch: listing.branch }
        : null;
  const up =
    listing && !missing
      ? listing.parent
        ? shortenPath(listing.parent, home)
        : null
      : parentOf(dir, home);

  return {
    dir,
    fragment,
    crumbs: crumbsOf(dir),
    up,
    rows,
    empty: missing
      ? 'missing'
      : !listing || rows.length > 0
        ? null
        : fragment
          ? 'filtered'
          : 'none',
    target,
    showRecent: dir === HOME && !fragment,
  };
}
