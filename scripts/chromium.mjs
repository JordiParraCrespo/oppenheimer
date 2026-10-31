import { existsSync } from 'node:fs';

/** Where a cloud sandbox keeps the Chromium it ships. */
export const SHIPPED_CHROMIUM = '/opt/pw-browsers/chromium';

/**
 * The Chromium every Playwright run in this repo launches, resolved in one
 * place so the suites and the screenshot script never disagree. An
 * environment that ships one (a container image, a cloud sandbox) names it
 * with `PLAYWRIGHT_CHROMIUM_PATH`, or keeps it at `SHIPPED_CHROMIUM`; its
 * build need not be the one Playwright pins, which is the one it would
 * otherwise download. Neither, and this is `undefined`: Playwright resolves
 * its own, which is what CI does.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string | undefined}
 */
export function chromiumPath(env = process.env) {
  if (env.PLAYWRIGHT_CHROMIUM_PATH) return env.PLAYWRIGHT_CHROMIUM_PATH;
  return existsSync(SHIPPED_CHROMIUM) ? SHIPPED_CHROMIUM : undefined;
}
