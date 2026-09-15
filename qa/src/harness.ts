import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type Browser,
  expect,
  type Locator,
  type Page,
  type TestInfo,
  test,
} from '@playwright/test';
import type { FixtureName } from '../fixtures/accounts.js';
import { type AppliedFixture, applyFixture } from '../fixtures/index.js';
import { ARTIFACTS_DIR, SCREENSHOTS_DIR } from './paths.js';
import type { RecordedCheck, RecordedShot, ScenarioResult } from './report.js';
import { loadPack, requireScenario, type Scenario } from './scenarios.js';

export const pack = loadPack();
export const WEB_URL = process.env.QA_WEB_URL ?? pack.environment.web;
export const API_URL = process.env.QA_API_URL ?? pack.environment.api;
/**
 * The control plane, which is a second app on a second port.
 *
 * `apps/admin-web` is not a route of `apps/web`: it has its own shell, its own
 * sign-in form and its own idea of who may be there at all. A scenario asking
 * "what does this person see" has to ask it of both, so the pack carries both
 * URLs and opens the control plane in its own browser context — sharing one
 * would make every cross-app check a question about cookie leakage instead.
 */
export const ADMIN_WEB_URL = process.env.QA_ADMIN_WEB_URL ?? pack.environment.adminWeb;

const VERDICTS_DIR = join(ARTIFACTS_DIR, 'verdicts');

/**
 * Fixtures applied so far in this worker.
 *
 * Each fixture owns its own organization, so applying one never disturbs
 * another and applying it twice in a run would only cost time — the volume
 * fixture writes forty thousand rows. Cached by name for that reason alone.
 */
const applied = new Map<string, AppliedFixture | null>();

async function ensureFixture(name: string): Promise<AppliedFixture | null> {
  if (!applied.has(name)) applied.set(name, await applyFixture(name as FixtureName));
  return applied.get(name) ?? null;
}

/**
 * How many pixels of the current screen a laptop cannot show.
 *
 * The shots are viewport-sized, which is the point — but a viewport shot that
 * silently drops the bottom third of a page is worse evidence than no shot at
 * all, because it looks complete. This counts what was left off, so the report
 * can say so and a reader knows to go and look.
 *
 * It asks the page rather than the document because this app scrolls an inner
 * element: `document.scrollingElement` never overflows, and the real scroller
 * is whichever descendant carries `overflow-y: auto`. Small in-card scrollers
 * — a combobox list, a code block — are not what a reader means by "below the
 * fold", so anything under the floor is ignored.
 */
const FOLD_NOISE_FLOOR = 24;

async function belowTheFold(page: Page): Promise<number> {
  return page.evaluate((floor) => {
    let worst = 0;
    for (const element of document.querySelectorAll<HTMLElement>('body *')) {
      const overflowY = getComputedStyle(element).overflowY;
      if (overflowY !== 'auto' && overflowY !== 'scroll') continue;
      worst = Math.max(worst, element.scrollHeight - element.clientHeight - element.scrollTop);
    }
    const root = document.scrollingElement;
    if (root) {
      worst = Math.max(worst, root.scrollHeight - root.clientHeight - root.scrollTop);
    }
    return worst > floor ? Math.round(worst) : 0;
  }, FOLD_NOISE_FLOOR);
}

/**
 * The recorder a scenario writes its verdict into.
 *
 * `check` is the important one, and it is deliberately not an assertion: a QA
 * pass wants every finding a scenario can produce, not just the first one.
 * Stopping at the first failed expectation is right for a unit test guarding a
 * regression and wrong here, where the output is a report someone triages.
 * Anything that genuinely cannot continue still uses `expect`.
 */
export class ScenarioRecorder {
  readonly checks: RecordedCheck[] = [];
  readonly screenshots: RecordedShot[] = [];
  readonly notes: string[] = [];

  constructor(
    readonly scenario: Scenario,
    private readonly testInfo: TestInfo,
  ) {}

  /** Record an observation and carry on. */
  check(label: string, ok: boolean, detail?: string): boolean {
    this.checks.push({ label, ok, detail });
    if (!ok)
      this.testInfo.annotations.push({
        type: 'failed-check',
        description: label,
      });
    return ok;
  }

  /** Compare two values, recording both sides so a failure explains itself. */
  checkEqual(label: string, actual: unknown, expected: unknown): boolean {
    const ok = Object.is(actual, expected);
    return this.check(
      label,
      ok,
      `rendered ${JSON.stringify(actual)}, database says ${JSON.stringify(expected)}`,
    );
  }

  /** Free-text context for the report — a timing, a payload shape, a caveat. */
  note(text: string): void {
    this.notes.push(text);
  }

  /**
   * The evidence: one laptop screen, as a person would see it.
   *
   * `fullPage` is deliberately off. The app shell is `h-svh` and scrolls an
   * inner element, so `fullPage` never captured more than the window anyway —
   * it only ever looked like it did because the window had been stretched to
   * 1400px tall to make the whole page fit. That produced complete evidence of
   * a screen nobody owns.
   *
   * So the shot is the viewport, and the honesty comes from
   * {@link belowTheFold}: anything the laptop could not show is counted and
   * noted in the report, rather than quietly cropped. "There were 320 more
   * pixels below" is a finding in its own right on a screen that is supposed
   * to fit.
   */
  async shot(page: Page, name: string, caption: string): Promise<string> {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    const file = `${name}.png`;
    const path = join(SCREENSHOTS_DIR, file);
    // Let anything still animating settle, or the evidence catches a chart
    // mid-transition and every run produces a different image.
    await page.waitForTimeout(400);
    await page.screenshot({ path });
    const hidden = await belowTheFold(page);
    if (hidden > 0) {
      this.note(`${name}: ${hidden}px of this screen sat below the fold at 1440×900`);
    }
    this.screenshots.push({ name, file, caption });
    await this.testInfo.attach(caption, { path, contentType: 'image/png' });
    return path;
  }

  /**
   * The evidence, narrowed to one region.
   *
   * A full-page shot of the same screen twice is one piece of evidence filed
   * under two names. When a scenario wants to point at a particular band of
   * the page — the KPI strip, one card — this frames it instead.
   */
  async shotOf(locator: Locator, name: string, caption: string, fallback?: Page): Promise<void> {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    const file = `${name}.png`;
    const path = join(SCREENSHOTS_DIR, file);
    const page = locator.page();
    await page.waitForTimeout(400);
    try {
      await locator.screenshot({ path });
    } catch {
      // The region is not on screen — an error state, an empty list. The
      // whole page is still worth having, and losing the evidence entirely
      // because one selector missed would be the wrong trade.
      await (fallback ?? page).screenshot({ path });
    }
    this.screenshots.push({ name, file, caption });
    await this.testInfo.attach(caption, { path, contentType: 'image/png' });
  }

  get failedChecks(): RecordedCheck[] {
    return this.checks.filter((check) => !check.ok);
  }

  /** Persist the verdict. One file per scenario; the runner merges them. */
  write(status: ScenarioResult['status'], durationMs: number, error?: string): void {
    mkdirSync(VERDICTS_DIR, { recursive: true });
    const result: ScenarioResult = {
      id: this.scenario.id,
      title: this.scenario.title,
      theme: this.scenario.theme,
      severity: this.scenario.severity,
      status,
      durationMs,
      checks: this.checks,
      screenshots: this.screenshots,
      notes: this.notes,
      error,
    };
    writeFileSync(join(VERDICTS_DIR, `${this.scenario.id}.json`), JSON.stringify(result, null, 2));
  }
}

export interface ScenarioContext {
  qa: ScenarioRecorder;
  scenario: Scenario;
  fixture: AppliedFixture | null;
  page: Page;
  /**
   * A page on the control plane, opened on first use.
   *
   * Lazy because most scenarios never touch it, and a second browser context
   * per scenario is not free. Closed for the scenario either way.
   */
  openAdmin: () => Promise<Page>;
}

/**
 * Binds a Playwright test to a scenario in `qa/scenarios`.
 *
 * The id is the whole registration mechanism: it names the YAML the test is
 * implementing, `qa coverage` finds it by searching for this call, and a
 * scenario nobody has bound to shows up as unimplemented rather than silently
 * counting as covered. Adding a case later is a YAML file plus one of these.
 */
export function scenario(id: string, body: (context: ScenarioContext) => Promise<void>): void {
  const definition = requireScenario(pack, id);

  test(`${id} — ${definition.title}`, async ({ page, browser }, testInfo) => {
    const startedAt = Date.now();
    const qa = new ScenarioRecorder(definition, testInfo);
    let thrown: unknown;
    let error: string | undefined;
    const admin = new LazyAdminPage(browser);

    // No `finally`: the verdict has to be written whichever way the body ends,
    // but rethrowing from a `finally` would replace whatever the body threw
    // with this function's own error and lose the actual failure.
    try {
      const fixture = await ensureFixture(definition.fixture);
      await body({ qa, scenario: definition, fixture, page, openAdmin: () => admin.open() });
    } catch (caught) {
      thrown = caught;
      error = caught instanceof Error ? (caught.stack ?? caught.message) : String(caught);
    }

    await admin.close();

    const failures = qa.failedChecks;
    qa.write(error || failures.length > 0 ? 'failed' : 'passed', Date.now() - startedAt, error);

    if (thrown) throw thrown;
    // A recorded failure has to fail the run too, or a red scenario would sit
    // inside a green suite and nobody would go and read the report.
    if (failures.length > 0) {
      throw new Error(
        `${id} recorded ${failures.length} failed check(s):\n` +
          failures
            .map((check) => `  · ${check.label}${check.detail ? ` — ${check.detail}` : ''}`)
            .join('\n'),
      );
    }
  });
}

/**
 * The control-plane page, created once per scenario and torn down with it.
 *
 * Its own context, with the same viewport and scale as the consumer one, so a
 * capture from either app is the same laptop screen.
 */
class LazyAdminPage {
  private page: Page | null = null;
  private context: Awaited<ReturnType<Browser['newContext']>> | null = null;

  constructor(private readonly browser: Browser) {}

  async open(): Promise<Page> {
    if (this.page) return this.page;
    this.context = await this.browser.newContext({
      baseURL: ADMIN_WEB_URL,
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    this.page = await this.context.newPage();
    return this.page;
  }

  async close(): Promise<void> {
    await this.context?.close().catch(() => {});
    this.page = null;
    this.context = null;
  }
}

/**
 * Sign in through the real form, the way a reader does.
 *
 * Returns whether the app let them in rather than asserting it. A scenario
 * about a refusal needs to *observe* the refusal, and an assertion here would
 * turn "this person is correctly kept out" into a harness crash.
 */
export async function signIn(page: Page, email: string, password: string): Promise<boolean> {
  // Signed out first, always. "Sign in as this person" has to mean that even
  // when the page is already carrying somebody's session — creating an account
  // through the API shares this cookie jar, and /login redirects an
  // authenticated reader away, so the form would never appear.
  await page.context().clearCookies();
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  try {
    await page.waitForURL(/\/(dashboard|onboarding|users)/, { timeout: 30_000 });
    return true;
  } catch {
    return false;
  }
}

/** Sign in, failing the scenario when the app was supposed to let them in. */
export async function signInOrFail(page: Page, email: string, password: string): Promise<void> {
  const ok = await signIn(page, email, password);
  expect(ok, `${email} should have been signed in`).toBe(true);
}

/**
 * Sign in through the API, sharing the page's cookie jar.
 *
 * For scenarios whose question is about an endpoint rather than a screen:
 * driving the form four times per scenario spends a minute of every run
 * re-testing AUTH-01. Better Auth refuses a cookie-bearing state change with no
 * `Origin`, which a browser always sends and a bare request context does not.
 */
export async function signInThroughApi(
  page: Page,
  email: string,
  password: string,
): Promise<boolean> {
  await page.context().clearCookies();
  const response = await page.request.post(`${API_URL}/api/auth/sign-in/email`, {
    headers: { Origin: WEB_URL },
    data: { email, password },
  });
  return response.ok();
}

/** Sign out by dropping the session cookie, which is all the session is. */
export async function signOut(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.evaluate(() => window.localStorage.clear()).catch(() => {});
}
