/** Where the time of the last reload is kept: this tab only, and gone with it. */
const RELOADED_AT_KEY = 'oppenheimer:stale-build-reload';

/** A second failure this soon after a reload is not a stale build: leave it to the screen. */
const RELOAD_GUARD_MS = 10_000;

/** The parts of `window` this reads, so a spec can hand it a fake one. */
export type StaleBuildWindow = Pick<Window, 'addEventListener' | 'sessionStorage'> & {
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
 * One reload per ten seconds: a chunk that still fails right after one is
 * really unreachable, and reloading again would loop, so that failure goes
 * on to the screen's own error state.
 */
export function reloadOnStaleBuild(target: StaleBuildWindow = window): void {
  target.addEventListener('vite:preloadError', (event) => {
    const now = Date.now();
    let last = 0;
    try {
      last = Number(target.sessionStorage.getItem(RELOADED_AT_KEY)) || 0;
      target.sessionStorage.setItem(RELOADED_AT_KEY, String(now));
    } catch {
      // Storage refused (a private window): reload once all the same.
    }
    if (now - last < RELOAD_GUARD_MS) return;
    event.preventDefault();
    target.location.reload();
  });
}
