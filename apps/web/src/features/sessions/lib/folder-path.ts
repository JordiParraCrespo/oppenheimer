/**
 * Paths as New session's folder picker writes and reads them. The host's own
 * paths are absolute; the picker shows the ones under the home directory as
 * `~/…`, the way a shell does, and takes `~` back from whoever types it. Pure:
 * the home comes from the host's listing (`useHostFolders`).
 */

export const HOME = '~';

/** `/home/jordi/code` → `~/code`, when `home` is `/home/jordi`. */
export function shortenPath(path: string, home: string | null | undefined): string {
  if (!home || home === '/') return path;
  if (path === home) return HOME;
  return path.startsWith(`${home}/`) ? `${HOME}${path.slice(home.length)}` : path;
}

/**
 * A shown path short enough for a chip: the root, `…` for the folders in
 * between, and the folder's own name. `~/code/jordi/atlas` → `~/…/atlas`.
 */
export function compactPath(path: string): string {
  const root = path.startsWith('/') ? '/' : path.startsWith(`${HOME}/`) ? `${HOME}/` : '';
  const parts = path.slice(root.length).split('/').filter(Boolean);
  return parts.length > 1 ? `${root}…/${parts.at(-1)}` : path;
}

/**
 * `~/code` → `/home/jordi/code`. Undefined while a path under `~` waits on a
 * home nobody has reported yet.
 */
export function expandPath(path: string, home: string | null | undefined): string | undefined {
  if (path === HOME) return home ?? undefined;
  if (path.startsWith(`${HOME}/`)) return home ? `${home}${path.slice(1)}` : undefined;
  return path;
}

/**
 * What a typed path asks for: the folder to list, and the start of a name to
 * narrow it to. A path that ends in `/` (or is `~` or `/`) is a folder; any
 * other is its parent plus the start of a name, so typing filters as it goes.
 * A bare word is read under home.
 */
export function parseFolderInput(text: string): { dir: string; fragment: string } {
  const typed = text.trim();
  if (typed === '' || typed === HOME) return { dir: HOME, fragment: '' };
  if (typed === '/') return { dir: '/', fragment: '' };
  if (typed.endsWith('/')) return { dir: typed.replace(/\/+$/, '') || '/', fragment: '' };
  const slash = typed.lastIndexOf('/');
  if (slash === -1) return { dir: HOME, fragment: typed };
  if (slash === 0) return { dir: '/', fragment: typed.slice(1) };
  return { dir: typed.slice(0, slash), fragment: typed.slice(slash + 1) };
}

/** The text that lists `dir`: with the trailing slash that marks it a folder. */
export function folderInput(dir: string): string {
  return dir === HOME || dir.endsWith('/') ? dir : `${dir}/`;
}

/** `~/code/atlas` → `~`, `~/code`, `~/code/atlas`; `/srv/app` → `/`, `/srv`, `/srv/app`. */
export function crumbsOf(dir: string): { name: string; dir: string }[] {
  const absolute = dir.startsWith('/');
  const parts = dir.split('/').filter(Boolean);
  const crumbs = absolute ? [{ name: '/', dir: '/' }] : [];
  parts.forEach((name, index) => {
    const head = parts.slice(0, index + 1).join('/');
    crumbs.push({ name, dir: absolute ? `/${head}` : head });
  });
  return crumbs;
}

/** The parent of a shown path; null at `/`. `~` goes up to its parent once the home is known. */
export function parentOf(dir: string, home: string | null | undefined): string | null {
  const absolute = expandPath(dir, home);
  if (!absolute || absolute === '/') return null;
  const slash = absolute.lastIndexOf('/');
  return shortenPath(slash <= 0 ? '/' : absolute.slice(0, slash), home);
}

/** The last segment, for "Use atlas"; `~` and `/` name themselves. */
export function leafOf(path: string): string {
  if (path === HOME || path === '/') return path;
  return path.replace(/\/+$/, '').split('/').pop() || path;
}
