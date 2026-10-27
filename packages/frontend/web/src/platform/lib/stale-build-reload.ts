/**
 * When a chunk last failed to load, reload or not: this tab only, and gone
 * with it.
 */
const FAILED_AT_KEY = 'oppenheimer:stale-build-reload';

/** A failure this soon after the last one is not a stale build: leave it to the screen. */
const RELOAD_GUARD_MS = 10_000;

/** The parts of `window` this reads, so a spec can hand it a fake one. */
export type StaleBuildWindow = Pick<Window, 'addEventListener'> & {
  sessionStorage: Pick<Storage, 'getItem' | 'setItem'>;
  location: Pick<Location, 'reload'>;
};

/**
 * Reload the page when a lazily loaded chunk fails to load because a deploy
 * replaced it. Every chunk name is a content hash, so a tab opened before a
 * release asks for files the release removed, and nginx answers those with
 * `index.html`: the import fails and the error lands in the nearest boundary,
 * where it reads as "Could not reach the server" (the row menu's Delete
 * emptied the whole session list this way). The reload fetches the current
 * `index.html` and its chunk names.
 *
 * Vite fires `vite:preloadError` for every failed dynamic import in a build.
 * Every failure is stamped, and only one with ten quiet seconds before it
 * reloads: a chunk that still fails right after a reload is really
 * unreachable, and a burst of failures is one stale build, so neither
 * reloads again; those failures go on to the screen's own error state. So
 * does every failure in a tab whose storage refuses the stamp.
 */
export function reloadOnStaleBuild(target: StaleBuildWindow = window): void {
  target.addEventListener('vite:preloadError', (event) => {
    const now = Date.now();
    let last: number;
    try {
      last = Number(target.sessionStorage.getItem(FAILED_AT_KEY)) || 0;
      target.sessionStorage.setItem(FAILED_AT_KEY, String(now));
    } catch {
      // Storage refused: a reload nothing records could not tell the next
      // failure from this one, and a chunk every load asks for (a locale
      // catalog) would reload for ever. Leave it to the screen.
      return;
    }
    if (now - last < RELOAD_GUARD_MS) return;
    event.preventDefault();
    target.location.reload();
  });
}
