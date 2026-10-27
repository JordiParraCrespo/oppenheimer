/**
 * The extension's manifest, as code: generated at build time with the
 * version from `package.json`, and its permission list held by
 * `src/__tests__/manifest.spec.ts`. Every permission is a promise to the
 * person installing it, so each one is here for one reason:
 *
 * - `https://claude.ai/*` — to read your session list with the claude.ai
 *   sign-in already in Chrome, and to watch claude.ai/code load it.
 * - `cookies` — to read one cookie, `lastActiveOrg`: which organization's
 *   sessions to ask for. Never the session cookie.
 * - `alarms` — the check every minute.
 * - `notifications` — "Needs you", "Failed", "Finished".
 * - `storage` — the list, between the worker and the popup.
 * - Optional, asked for when the person connects Oppenheimer and only for
 *   the API they name: the host the statuses are reported to.
 */
export const ICON_SIZES = [16, 32, 48, 128] as const;

const icons = Object.fromEntries(ICON_SIZES.map((size) => [size, `icons/icon-${size}.png`]));

export function defineManifest({ version }: { version: string }): chrome.runtime.ManifestV3 {
  return {
    manifest_version: 3,
    // Chrome's own strings are `_locales/`, which the build writes from
    // `@oppenheimer/translations` (`extension.chrome`).
    name: '__MSG_extName__',
    short_name: '__MSG_extShortName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    version,
    // The build's target. A `world: 'MAIN'` content script needs 111.
    minimum_chrome_version: '116',
    icons,
    action: {
      default_title: '__MSG_actionTitle__',
      default_popup: 'popup.html',
      default_icon: icons,
    },
    background: { service_worker: 'background.js', type: 'module' },
    permissions: ['alarms', 'cookies', 'notifications', 'storage'],
    host_permissions: ['https://claude.ai/*'],
    optional_host_permissions: ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*'],
    content_scripts: [
      // In claude.ai's own page, to see its fetches; it can reach no chrome.* API…
      { matches: ['https://claude.ai/*'], js: ['tap.js'], run_at: 'document_start', world: 'MAIN' },
      // …so this one, in the extension's world, carries what it saw to the worker.
      { matches: ['https://claude.ai/*'], js: ['bridge.js'], run_at: 'document_start' },
    ],
    content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'" },
  };
}
