import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { connectInstallation } from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Screenshots of the console for a pull request that changes what it looks
 * like: every route in `SCREENS`, light and dark, at every width in
 * `SCREENS_WIDTHS`, signed in as a fresh account with its own workspace.
 * Not a test of anything: it is the camera the `local-stack` skill points at
 * a visual change, and it only runs when `SCREENS` names something.
 *
 *   SCREENS="/sessions,/settings/profile" pnpm --filter @oppenheimer/e2e screens
 *
 * - `anon:/login` photographs a route signed out.
 * - `SCREENS_GITHUB=1` connects a stub GitHub installation first, so the
 *   composer and the project screens have repositories to show.
 * - `SCREENS_WIDTHS` (default `1440`) is a comma list; `390` is a phone.
 * - `SCREENS_OUT` (default `.screenshots/` at the repo root, git-ignored).
 *
 * It writes `manifest.json` beside the pictures: the commit and whether the
 * tree was dirty, so a reader knows which code the pictures are of.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = resolve(process.env.SCREENS_OUT ?? join(ROOT, '.screenshots'));
const WIDTHS = (process.env.SCREENS_WIDTHS ?? '1440')
  .split(',')
  .map((width) => Number(width.trim()))
  .filter((width) => width > 0);
const THEMES = ['light', 'dark'] as const;

interface Shot {
  route: string;
  signedIn: boolean;
}

function shots(): Shot[] {
  return (process.env.SCREENS ?? '')
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((entry) =>
      entry.startsWith('anon:')
        ? { route: entry.slice('anon:'.length), signedIn: false }
        : { route: entry, signedIn: true },
    );
}

function slug(shot: Shot): string {
  const name = shot.route.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9]+/g, '-') || 'root';
  return shot.signedIn ? name : `anon-${name}`;
}

function git(...args: string[]): string {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/** The page has drawn: no request in flight, fonts loaded, no skeleton left. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0, { timeout: 15_000 });
}

test('photographs the screens a change touches', async ({ browser }) => {
  const list = shots();
  test.skip(list.length === 0, 'SCREENS names no route');
  test.setTimeout(60_000 + list.length * WIDTHS.length * 30_000);
  mkdirSync(OUT, { recursive: true });

  const owner = list.some((shot) => shot.signedIn) ? await provisionedUser('screens') : null;
  if (owner && process.env.SCREENS_GITHUB) await connectInstallation(owner.api);

  const files: { route: string; signedIn: boolean; width: number; theme: string; file: string }[] =
    [];
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        viewport: { width, height: width < 768 ? 844 : 900 },
        colorScheme: theme,
      });
      const page = await context.newPage();
      if (owner) await signInAs(page, owner.user);
      for (const shot of list) {
        if (!shot.signedIn) await context.clearCookies();
        await page.goto(shot.route);
        await settle(page);
        // The console follows the OS appearance unless the account chose one.
        await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`));
        const file = join(OUT, `${slug(shot)}-${width}-${theme}.png`);
        await page.screenshot({ path: file, fullPage: true });
        files.push({ ...shot, width, theme, file: relative(ROOT, file) });
        if (!shot.signedIn && owner) await signInAs(page, owner.user);
      }
      await context.close();
    }
  }

  writeFileSync(
    join(OUT, 'manifest.json'),
    `${JSON.stringify(
      {
        commit: git('rev-parse', 'HEAD'),
        dirty: git('status', '--porcelain', '--untracked-files=no') !== '',
        takenAt: new Date().toISOString(),
        files,
      },
      null,
      2,
    )}\n`,
  );
  console.log(files.map((shot) => shot.file).join('\n'));
});
