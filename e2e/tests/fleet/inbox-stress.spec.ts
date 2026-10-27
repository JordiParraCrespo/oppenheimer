import { type APIRequestContext, type Browser, expect, type Page, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { insertPendingBotApproval } from '../../support/db';
import { type FleetHost, pairedHosts } from '../../support/fleet';
import {
  answerInTranscript,
  createStressSession,
  expectedHex,
  FALLBACK_SCREEN,
  holdScreen,
  IDLE_SCREEN,
  PERMISSIONS,
  type PermissionScenario,
  paneText,
  permissionLabels,
  type QuestionScenario,
  questionScenarios,
  received,
  release,
  startWaiting,
  type WaitingScenario,
  WORKING_SCREEN,
  waitForShim,
} from '../../support/inbox-stress';
import {
  connectInstallation,
  createProject,
  STUB_REPOSITORIES,
  waitForLifecycle,
} from '../../support/sessions';
import { signInAs } from '../../support/web';

/**
 * The Inbox under load, on real runners (`29-inbox.md`, "Stress test"): one
 * account with three local hosts, thirty sessions in every scenario the Inbox
 * reads — permission dialogs of several shapes, questions from one choice to
 * four with words of their own, blocked with nothing to read, working, idle,
 * failed — ten bots, six of them waiting on an approval, and the GitHub
 * stub's pull requests. Every permission and question is answered from the
 * Inbox, some back to back, a batch from two pages at once, one from two
 * pages at the same moment; each session's shell records the bytes it gets,
 * and each must hold exactly its own answer. Then the approvals, the marks,
 * and what loading the Inbox costs.
 *
 * Opt-in (`INBOX_STRESS=1`): it takes about ten minutes and pairs three
 * hosts. Needs the console on `WEB_URL`.
 */
const STRESS = Boolean(process.env.INBOX_STRESS);
test.describe.configure({ timeout: 40 * 60_000 });
// A click that can never land fails in seconds, not at the end of the test.
test.use({ baseURL: WEB_URL, actionTimeout: 30_000 });

type Kind = 'permission' | 'question' | 'fallback' | 'working' | 'idle' | 'failed';

interface Planned {
  index: number;
  kind: Kind;
  host: number;
  projectId?: string;
  scenario?: WaitingScenario;
  id: string;
  /** The round of the wait in hand, naming its files on the host. */
  round: string;
}

interface SessionRow {
  id: string;
  name: string;
  state: string;
  lifecycle: string;
  observedSince: string | null;
  stateSeq: number;
  createdAt: string;
  lastEventAt: string | null;
  decision: { id: string; kind: string } | null;
}

interface PullRow {
  githubRepoId: number;
  number: number;
  headSha: string;
  scope: string;
  blocker: string | null;
}

/** The stress's notebook: every number and every failure goes here and into the report. */
const notes: string[] = [];
function note(line: string): void {
  notes.push(line);
  console.log(`[inbox-stress] ${line}`);
}

async function sessionRows(api: APIRequestContext): Promise<SessionRow[]> {
  const rows: SessionRow[] = [];
  let cursor: string | undefined;
  for (;;) {
    const response = await api.get('/api/v1/sessions', {
      params: { limit: 100, ...(cursor ? { cursor } : {}) },
    });
    expect(response.status(), await response.text()).toBe(200);
    const body = (await response.json()) as {
      data: SessionRow[];
      meta: { nextCursor: string | null };
    };
    rows.push(...body.data);
    if (!body.meta.nextCursor) return rows;
    cursor = body.meta.nextCursor;
  }
}

function sessionKey(row: SessionRow): string {
  if (row.decision) return `session:${row.id}:${row.decision.id}`;
  if (row.lifecycle === 'open' && row.observedSince) {
    return `session:${row.id}:${new Date(row.observedSince).toISOString()}`;
  }
  return `session:${row.id}:s${row.stateSeq}`;
}

/** The keys the Inbox should list, by the API's own reads, and why each is there. */
async function expectedItems(api: APIRequestContext, approvalsLeft: boolean) {
  const keys = new Map<string, 'session' | 'approval' | 'requested' | 'ready'>();
  for (const row of await sessionRows(api)) {
    if (row.state === 'waiting-on-you') keys.set(sessionKey(row), 'session');
  }
  if (approvalsLeft) {
    const approvals = (await (
      await api.get('/api/v1/bot-approvals', { params: { status: 'pending' } })
    ).json()) as { id: string }[];
    for (const approval of approvals) keys.set(`approval:${approval.id}`, 'approval');
  }
  for (const scope of ['requested', 'mine'] as const) {
    const queue = (await (await api.get('/api/v1/pulls', { params: { scope } })).json()) as {
      items: PullRow[];
    };
    for (const pull of queue.items) {
      if (pull.scope !== scope) continue;
      if (scope === 'mine' && pull.blocker !== null) continue;
      const key = `pull:${pull.githubRepoId}#${pull.number}@${pull.headSha}`;
      if (!keys.has(key)) keys.set(key, scope === 'requested' ? 'requested' : 'ready');
    }
  }
  return keys;
}

/** The rows the list draws, as the occurrence keys their links carry. */
async function listedKeys(page: Page): Promise<string[]> {
  return page.locator('[data-slot="inbox-item"]:not([data-done])').evaluateAll((rows) =>
    rows.map((row) => {
      const href = row.getAttribute('href') ?? '';
      return new URL(href, window.location.origin).searchParams.get('item') ?? '';
    }),
  );
}

/** The count beside "Needs you", the bar's "N need you", and the rail's badge. */
async function counts(page: Page) {
  const head = await page
    .locator('[data-slot="sidebar-list-head"]', { hasText: 'Needs you' })
    .locator('.figures')
    .textContent();
  const bar =
    (await page
      .getByText(/\d+ needs? you|Nothing needs you/)
      .first()
      .textContent()) ?? '';
  // The rail's count is the tip beside its Inbox item, and the item's description.
  const rail = await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Inbox' })
    .locator('[data-slot="rail-tip"] .figures')
    .textContent();
  return { head: Number(head), bar: Number(/(\d+)/.exec(bar)?.[1] ?? 0), rail: Number(rail) };
}

function rowOf(page: Page, sessionId: string) {
  return page.locator(`[data-slot="inbox-item"][href*="${sessionId}"]`);
}

/** Puts the session's item in the pane, from its row. */
async function openRow(page: Page, sessionId: string) {
  const row = rowOf(page, sessionId);
  await expect(row, `the row of ${sessionId}`).toBeVisible({ timeout: 60_000 });
  await row.click();
  await expect(row).toHaveAttribute('data-active', 'true');
  return page.locator('[data-slot="inbox-card"]');
}

async function answerPermission(page: Page, plan: Planned) {
  const scenario = plan.scenario as PermissionScenario;
  const card = await openRow(page, plan.id);
  const choices = card.locator('[data-slot="inbox-card-choices"]').getByRole('button');
  await expect(choices).toHaveText(permissionLabels(scenario));
  await choices.nth(scenario.answer).click();
}

async function answerQuestion(page: Page, plan: Planned) {
  const scenario = plan.scenario as QuestionScenario;
  const card = await openRow(page, plan.id);
  const questions = card.locator('[data-slot="inbox-question"]');
  await expect(questions).toHaveCount(scenario.questions.length);
  for (const [i, question] of scenario.questions.entries()) {
    const answer = scenario.answers[i];
    const field = questions.nth(i);
    await expect(field).toContainText(question.question);
    for (const pick of answer.picks) {
      const label = question.options[pick].label;
      await field
        .locator('[data-slot="inbox-question-option"]')
        .filter({ hasText: label })
        .first()
        .click();
    }
    if (answer.other) await field.getByRole('textbox').fill(answer.other);
  }
  await card.getByRole('button', { name: 'Send answers' }).click();
}

async function answer(page: Page, plan: Planned) {
  if (plan.scenario?.kind === 'permission') await answerPermission(page, plan);
  else await answerQuestion(page, plan);
}

/** The answer was taken: its row left the list. On a miss, says what the row, the card and the log held. */
async function expectAnswered(page: Page, plan: Planned) {
  try {
    await expect(rowOf(page, plan.id)).toHaveCount(0, { timeout: 20_000 });
  } catch (error) {
    const href = await rowOf(page, plan.id)
      .first()
      .getAttribute('href')
      .catch(() => null);
    const card = await page
      .locator('[data-slot="inbox-card"]')
      .innerText()
      .catch(() => '');
    const log = await page.locator('[data-slot="inbox-log-line"]').allInnerTexts();
    throw new Error(
      `#${plan.index} ${plan.kind} ${plan.id} did not leave the list\nrow: ${href}\ncard: ${card}\nlog: ${log.join(' | ')}`,
      { cause: error },
    );
  }
}

async function secondPage(browser: Browser, user: { email: string; password: string }) {
  const context = await browser.newContext({ baseURL: WEB_URL });
  const page = await context.newPage();
  await signInAs(page, user);
  return page;
}

/**
 * Opens the Inbox in a fresh page and counts: how long until the first card
 * can be answered, the API requests that took, and the requests over a minute
 * of doing nothing (polls and refetches). A read per item, or a refetch per
 * workspace event, shows up here.
 */
async function measureLoad(
  browser: Browser,
  user: { email: string; password: string },
  api: APIRequestContext,
  label: string,
) {
  const reader = await secondPage(browser, user);
  // What the sources hold, less what a mark hides (done, snoozed, deleted).
  const marks = (await (await api.get('/api/v1/inbox/marks')).json()) as {
    itemKey: string;
    mark: string;
  }[];
  const hidden = new Set(marks.filter((m) => m.mark !== 'low').map((m) => m.itemKey));
  const items = [...(await expectedItems(api, true)).keys()].filter((k) => !hidden.has(k)).length;
  const requests: { path: string; at: number }[] = [];
  reader.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      requests.push({
        path: url.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id'),
        at: Date.now(),
      });
    }
  });
  // Settings first, so the session and the flags are loaded and only the
  // Inbox's own reads are counted; the workspace stream never goes idle, so
  // the waits are fixed.
  await reader.goto('/settings');
  await reader.waitForTimeout(3_000);
  const start = Date.now();
  await reader.goto('/inbox');
  await expect(reader.locator('[data-slot="inbox-card"]').getByRole('button').first()).toBeEnabled({
    timeout: 30_000,
  });
  await expect.poll(async () => (await listedKeys(reader)).length).toBe(items);
  const interactive = Date.now() - start;
  await reader.waitForTimeout(5_000);
  const onLoad = requests.filter((r) => r.at >= start);
  const loadedAt = Date.now();
  await reader.waitForTimeout(60_000);
  const idle = requests.filter((r) => r.at > loadedAt);
  const summary = (rows: { path: string }[]) => {
    const byPath = new Map<string, number>();
    for (const r of rows) byPath.set(r.path, (byPath.get(r.path) ?? 0) + 1);
    return [...byPath].map(([path, n]) => `${path}×${n}`).join(', ');
  };
  note(
    `load (${label}, ${items} items): interactive in ${interactive} ms; ${onLoad.length} API requests (${summary(onLoad)}); ${idle.length} in 60 s idle (${summary(idle)})`,
  );
  expect(
    onLoad.filter((r) => r.path.startsWith('/api/v1/sessions/:id')).length,
    'no read per session on load',
  ).toBe(0);
  expect(idle.length, 'nothing refetched while idle beyond a poll or two').toBeLessThan(10);
  await reader.context().close();
}

async function consoleUp(): Promise<boolean> {
  return fetch(WEB_URL).then(
    (response) => response.ok,
    () => false,
  );
}

test('the Inbox holds under thirty sessions, ten bots and two readers', async ({
  page,
  browser,
}) => {
  test.skip(!STRESS, 'the Inbox stress runs with INBOX_STRESS=1');
  test.skip(!(await consoleUp()), `the console is not running on ${WEB_URL}`);

  const { api, user } = await signedUpContext('inboxstress');
  const installationId = await connectInstallation(api);
  const mobile = await createProject(api, installationId, 'Stress mobile');
  const web = await api.post('/api/v1/projects', {
    data: {
      name: 'Stress web',
      repositories: [
        {
          installationId,
          githubRepoId: STUB_REPOSITORIES.web.githubRepoId,
          baseBranch: STUB_REPOSITORIES.web.defaultBranch,
          isDefault: true,
        },
      ],
    },
  });
  expect(web.status(), await web.text()).toBe(201);
  const webProject = ((await web.json()) as { id: string }).id;
  // Watching both repositories brings the stub's pull requests in: reviews
  // asked of the reader, and theirs that can merge.
  for (const repository of Object.values(STUB_REPOSITORIES)) {
    const watched = await api.put(
      `/api/v1/pulls/repositories/${installationId}/${repository.githubRepoId}`,
      { data: { watching: true } },
    );
    expect(watched.status(), await watched.text()).toBe(204);
  }
  const boxes = await pairedHosts(api, 3, 'stress');
  const host = (plan: Planned): FleetHost => boxes[plan.host].host;

  // Ten bots, six of them stopped on an approval.
  const bots: { id: string; name: string; approvalId?: string }[] = [];
  for (let i = 0; i < 10; i += 1) {
    const created = await api.post('/api/v1/bots', {
      data: { name: `Bot ${String.fromCharCode(65 + i)}`, provider: 'glm' },
    });
    expect(created.status(), await created.text()).toBe(201);
    bots.push({
      ...((await created.json()) as { id: string }),
      name: `Bot ${String.fromCharCode(65 + i)}`,
    });
  }
  for (const bot of bots.slice(0, 6)) {
    bot.approvalId = await insertPendingBotApproval(
      bot.id,
      'start_session',
      `${bot.name} wants a session on xrp-mobile to fix the flaky login test.`,
    );
  }

  // Thirty sessions: the mix the brief asks for.
  const questions = questionScenarios(`${Date.now().toString(36)}`);
  const kinds: { kind: Kind; scenario?: WaitingScenario }[] = [
    ...PERMISSIONS.map((scenario) => ({ kind: 'permission' as const, scenario })),
    ...questions.map((scenario) => ({ kind: 'question' as const, scenario })),
    ...Array.from({ length: 4 }, () => ({ kind: 'fallback' as const })),
    ...Array.from({ length: 5 }, () => ({ kind: 'working' as const })),
    ...Array.from({ length: 3 }, () => ({ kind: 'idle' as const })),
    ...Array.from({ length: 2 }, () => ({ kind: 'failed' as const })),
  ];
  expect(kinds).toHaveLength(30);
  const projects = [mobile, webProject, undefined];
  const plans: Planned[] = await Promise.all(
    kinds.map(async ({ kind, scenario }, index) => {
      const plan = {
        index,
        kind,
        scenario,
        host: index % boxes.length,
        projectId: projects[index % projects.length],
      };
      const id = await createStressSession(api, boxes[plan.host].id, installationId, {
        projectId: plan.projectId,
        baseBranch: kind === 'failed' ? 'stress/no-such-branch' : undefined,
      });
      return { ...plan, id, round: `${id}-1` };
    }),
  );
  const of = (kind: Kind) => plans.filter((plan) => plan.kind === kind);
  note(`created ${plans.length} sessions on ${boxes.length} hosts`);

  await test.step('every session reaches its scenario', async () => {
    const live = plans.filter((plan) => plan.kind !== 'failed');
    await Promise.all(live.map((plan) => waitForShim(host(plan), plan.id)));
    for (const plan of live) {
      if (plan.scenario) startWaiting(host(plan), plan.id, plan.round, plan.scenario);
      else if (plan.kind === 'fallback')
        holdScreen(host(plan), plan.id, plan.round, FALLBACK_SCREEN);
      else if (plan.kind === 'working') holdScreen(host(plan), plan.id, plan.round, WORKING_SCREEN);
      else holdScreen(host(plan), plan.id, plan.round, IDLE_SCREEN);
    }
    await Promise.all(
      of('failed').map((plan) => waitForLifecycle(api, plan.id, 'failed', 180_000)),
    );
    // One idle session is stopped: a stopped session waits on nobody.
    const stopped = await api.post(`/api/v1/sessions/${of('idle')[0].id}/stop`);
    expect(stopped.status(), await stopped.text()).toBeLessThan(300);
  });

  const waiting = plans.filter((plan) =>
    ['permission', 'question', 'fallback', 'failed'].includes(plan.kind),
  );
  await test.step('the API counts each waiting session, with its decision', async () => {
    const started = Date.now();
    await expect
      .poll(
        async () => {
          const rows = await sessionRows(api);
          const byId = new Map(rows.map((row) => [row.id, row]));
          const wrong = plans.flatMap((plan) => {
            const row = byId.get(plan.id);
            const shouldWait = waiting.includes(plan);
            const waits = row?.state === 'waiting-on-you';
            const decision = row?.decision?.kind ?? null;
            const wantDecision = plan.scenario?.kind ?? null;
            if (waits !== shouldWait || (shouldWait && decision !== wantDecision)) {
              return [`#${plan.index} ${plan.kind}: ${row?.state} decision=${decision}`];
            }
            return [];
          });
          return wrong;
        },
        { timeout: 240_000, intervals: [5_000] },
      )
      .toEqual([]);
    note(
      `all 22 waiting sessions counted ${Math.round((Date.now() - started) / 1000)} s after their screens were drawn`,
    );
  });

  await test.step('the list, the counts and the order agree with the sources', async () => {
    await signInAs(page, user);
    // The pull request queue fills from GitHub in the background, so the
    // sources are read again on each look, as the Inbox reads them.
    let expected = await expectedItems(api, true);
    await expect
      .poll(
        async () => {
          expected = await expectedItems(api, true);
          const listed = (await listedKeys(page)).sort();
          const want = [...expected.keys()].sort();
          return {
            missing: want.filter((k) => !listed.includes(k)),
            extra: listed.filter((k) => !want.includes(k)),
          };
        },
        { timeout: 90_000, intervals: [3_000] },
      )
      .toEqual({ missing: [], extra: [] });
    note(`the Inbox lists ${expected.size} items`);
    await expect
      .poll(() => counts(page))
      .toEqual({
        head: expected.size,
        bar: expected.size,
        rail: expected.size,
      });

    // Order: approvals and sessions, oldest wait first; then reviews; then merges.
    const listed = await listedKeys(page);
    const rank = (key: string) => {
      const why = expected.get(key);
      return why === 'requested' ? 1 : why === 'ready' ? 2 : 0;
    };
    const ranks = listed.map(rank);
    expect(ranks, 'ranks never go back').toEqual([...ranks].sort((a, b) => a - b));

    // The card each kind draws.
    for (const plan of waiting) {
      const card = await openRow(page, plan.id);
      if (plan.kind === 'permission') {
        const scenario = plan.scenario as PermissionScenario;
        await expect(card.getByRole('heading', { name: scenario.title })).toBeVisible();
        await expect(
          card.locator('[data-slot="inbox-card-choices"]').getByRole('button'),
        ).toHaveText(permissionLabels(scenario));
      } else if (plan.kind === 'question') {
        await expect(card.locator('[data-slot="inbox-question"]')).toHaveCount(
          (plan.scenario as QuestionScenario).questions.length,
        );
      } else {
        await expect(card.locator('[data-slot="inbox-card-choices"]')).toHaveCount(0);
        await expect(card.getByRole('link', { name: 'Open session' })).toBeVisible();
        await expect(card.getByRole('heading')).toContainText(
          plan.kind === 'failed' ? 'failed' : 'is waiting on you',
        );
      }
    }

    // Project facet: each project's count and No project add up to the whole.
    const rows = await sessionRows(api);
    const projectOf = new Map(
      rows.map((row) => [row.id, plans.find((p) => p.id === row.id)?.projectId]),
    );
    let sum = 0;
    for (const project of [mobile, webProject, 'none']) {
      await page.goto(`/inbox?project=${project}`);
      await expect(page.locator('[data-slot="inbox-item"]').first()).toBeVisible();
      const keys = await listedKeys(page);
      sum += keys.length;
      for (const key of keys.filter((k) => k.startsWith('session:'))) {
        const id = key.split(':')[1];
        expect(projectOf.get(id) ?? 'none', `${key} under ${project}`).toBe(project);
      }
    }
    expect(sum, 'every item is under exactly one project here').toBe(expected.size);
    await page.goto('/inbox');
  });

  await test.step('what loading the full Inbox costs', () =>
    measureLoad(browser, user, api, 'full'));

  // The follow-up session and the stale one are kept apart from the batches.
  const permissions = of('permission');
  const asked = of('question');
  const stale = permissions[permissions.length - 1];
  const followUp = asked[0];
  const second = await secondPage(browser, user);

  await test.step('every permission and question is answered from the Inbox', async () => {
    // Back to back on one page: each answer as soon as the last one left.
    const serial = [...permissions.slice(0, 4), ...asked.slice(0, 4)];
    const paths = new Map<string, number>();
    const tally = (request: { url(): string }) => {
      const url = new URL(request.url());
      if (!url.pathname.startsWith('/api/')) return;
      const path = url.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id');
      paths.set(path, (paths.get(path) ?? 0) + 1);
    };
    page.on('request', tally);
    const answeredAt = Date.now();
    for (const plan of serial) {
      await answer(page, plan);
      await expectAnswered(page, plan);
    }
    page.off('request', tally);
    // The header, the bar and the rail count what the list shows the moment
    // an answer lands, not once each runner reports its agent moved on.
    const right = { ...(await counts(page)), list: (await listedKeys(page)).length };
    note(
      `just after the last answer: head ${right.head}, bar ${right.bar}, rail ${right.rail}, list ${right.list}`,
    );
    await expect
      .poll(
        async () => {
          const now = await counts(page);
          const list = (await listedKeys(page)).length;
          return [now.head, now.bar, now.rail].every((n) => n === list);
        },
        { timeout: 5_000, intervals: [500] },
      )
      .toBe(true);
    const total = [...paths.values()].reduce((sum, n) => sum + n, 0);
    note(
      `${serial.length} answered back to back in ${Math.round((Date.now() - answeredAt) / 1000)} s, ${total} API requests (${[...paths].map(([p, n]) => `${p}×${n}`).join(', ')})`,
    );

    // A batch from two pages at once, each page its own half.
    const batch = [...permissions.slice(4, permissions.length - 1), ...asked.slice(4)];
    await second.goto('/inbox');
    const halves = [batch.filter((_, i) => i % 2 === 0), batch.filter((_, i) => i % 2 === 1)];
    await Promise.all(
      [page, second].map(async (reader, i) => {
        for (const plan of halves[i]) {
          await answer(reader, plan);
          await expectAnswered(reader, plan);
        }
      }),
    );
    note(`${batch.length} answered from two pages at once`);
  });

  await test.step('two pages answer the same permission at the same moment: one wins', async () => {
    await page.goto('/inbox');
    await second.goto('/inbox');
    const scenario = stale.scenario as PermissionScenario;
    const cards = await Promise.all([openRow(page, stale.id), openRow(second, stale.id)]);
    // Each page's answer is held until both have been sent, so the two reach
    // the API together: otherwise the first answer's event reaches the other
    // page first and its card stops offering the choice, which is right but
    // is not a race.
    const readers = [page, second];
    let release: () => void = () => {};
    const bothSent = new Promise<void>((resolve) => {
      release = resolve;
    });
    let sent = 0;
    const statuses: number[] = [];
    for (const reader of readers) {
      await reader.route(`**/api/v1/sessions/${stale.id}/decision`, async (route) => {
        sent += 1;
        if (sent === 2) release();
        await bothSent;
        await route.continue();
      });
      reader.on('response', (response) => {
        if (response.url().endsWith(`/sessions/${stale.id}/decision`)) {
          statuses.push(response.status());
        }
      });
    }
    await Promise.all(
      cards.map((card) =>
        card
          .locator('[data-slot="inbox-card-choices"]')
          .getByRole('button')
          .nth(scenario.answer)
          .click(),
      ),
    );
    await expect.poll(() => statuses.length, { timeout: 30_000 }).toBe(2);
    for (const reader of readers) await reader.unroute(`**/api/v1/sessions/${stale.id}/decision`);
    note(`stale race: the two answers were answered ${statuses.sort().join(' and ')}`);
    expect(statuses.sort(), 'one answer taken, the other refused as stale').toEqual([200, 409]);
    const refusals = readers.map((reader) =>
      reader.getByText('That question was already answered or changed.', { exact: false }),
    );
    await expect
      .poll(async () => (await refusals[0].count()) + (await refusals[1].count()))
      .toBe(1);
  });

  await test.step('each session received exactly its own keys, once', async () => {
    const answeredPlans = [...permissions, ...asked];
    await expect
      .poll(
        () =>
          answeredPlans.flatMap((plan) => {
            const got = received(host(plan), plan.round);
            const want = expectedHex(plan.scenario as WaitingScenario);
            return got === want
              ? []
              : [`#${plan.index} ${plan.kind}: got ${got ?? '(window open)'} want ${want}`];
          }),
        { timeout: 90_000, intervals: [3_000] },
      )
      .toEqual([]);
    // Nobody else was typed into: the sessions that were not answered received nothing.
    for (const plan of [...of('fallback'), ...of('working')]) {
      expect(
        paneText(host(plan), plan.id),
        `#${plan.index} ${plan.kind} was typed into`,
      ).not.toMatch(/GOT:/);
    }
  });

  await test.step('a follow-up question on an answered session is a new item, and answerable', async () => {
    answerInTranscript(
      host(followUp),
      followUp.id,
      (followUp.scenario as QuestionScenario).toolUseId,
    );
    const next: QuestionScenario = {
      kind: 'question',
      toolUseId: `${(followUp.scenario as QuestionScenario).toolUseId}_next`,
      questions: [
        {
          header: 'Next',
          question: 'Now that the screens are picked, open a pull request?',
          multiSelect: false,
          options: [{ label: 'Open it' }, { label: 'Wait' }],
        },
      ],
      answers: [{ picks: [0], other: null }],
    };
    followUp.scenario = next;
    followUp.round = `${followUp.id}-2`;
    startWaiting(host(followUp), followUp.id, followUp.round, next);
    await expect(async () => {
      await page.goto('/inbox');
      const card = await openRow(page, followUp.id);
      await expect(card.locator('[data-slot="inbox-question"]')).toContainText(
        'open a pull request?',
        { timeout: 3_000 },
      );
    }).toPass({ timeout: 150_000, intervals: [5_000] });
    await answer(page, followUp);
    await expectAnswered(page, followUp);
    await expect
      .poll(() => received(host(followUp), followUp.round), { timeout: 60_000 })
      .toBe(expectedHex(next));
  });

  await test.step('bot approvals are approved and denied from the Inbox', async () => {
    await page.goto('/inbox');
    for (const [i, bot] of bots.slice(0, 6).entries()) {
      const row = page.locator(`[data-slot="inbox-item"][href*="${bot.approvalId}"]`);
      await row.click();
      const card = page.locator('[data-slot="inbox-card"]');
      await card
        .getByRole('button', { name: i % 2 === 0 ? 'Approve' : 'Deny', exact: true })
        .click();
      await expect(row).toHaveCount(0, { timeout: 15_000 });
    }
    await expect
      .poll(
        async () =>
          (
            (await (
              await api.get('/api/v1/bot-approvals', { params: { status: 'pending' } })
            ).json()) as unknown[]
          ).length,
      )
      .toBe(0);
  });

  await test.step('marks persist across a reload and a second page, and a new wait comes back', async () => {
    const [snoozed, low, done] = of('fallback');
    const menu = async (plan: Planned, item: string | RegExp) => {
      const row = rowOf(page, plan.id);
      await row.hover();
      await page
        .locator('[data-slot="inbox-row"]', { has: row })
        .getByRole('button', { name: 'Item actions' })
        .click();
      await page.getByRole('menuitem', { name: item }).click();
    };
    await page.goto('/inbox');
    await menu(snoozed, 'Snooze 1 hour');
    await menu(low, 'Deprioritize');
    await menu(done, /Mark as done/);
    await expect
      .poll(async () => ((await (await api.get('/api/v1/inbox/marks')).json()) as unknown[]).length)
      .toBe(3);

    for (const reader of [page, second]) {
      await reader.goto('/inbox');
      await expect(rowOf(reader, done.id)).toHaveCount(0);
      await expect(rowOf(reader, snoozed.id)).toHaveCount(0);
      await expect(reader.locator('[data-slot="inbox-snoozed-row"]')).toHaveCount(1);
      const keys = await listedKeys(reader);
      expect(keys.at(-1), 'the low item sorts last').toContain(low.id);
      await expect(rowOf(reader, low.id)).toContainText('Low');
    }

    // A new wait on the session marked done: its agent asks for a permission.
    const scenario = PERMISSIONS[0];
    done.scenario = scenario;
    done.round = `${done.id}-2`;
    release(host(done), done.id);
    startWaiting(host(done), done.id, done.round, scenario);
    await expect(async () => {
      await page.goto('/inbox');
      await expect(rowOf(page, done.id)).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 150_000, intervals: [5_000] });
    await answer(page, done);
    await expectAnswered(page, done);
    await expect
      .poll(() => received(host(done), done.round), { timeout: 60_000 })
      .toBe(expectedHex(scenario));
  });

  await test.step('what loading the Inbox costs, once it is mostly answered', () =>
    measureLoad(browser, user, api, 'the end'));

  for (const line of notes) test.info().annotations.push({ type: 'stress', description: line });
  await second.context().close();
  await api.dispose();
});
