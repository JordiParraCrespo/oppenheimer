import { writeFileSync } from 'node:fs';
import { type Page, test } from '@playwright/test';
import { pairHost } from '../../../support/sessions';
import { provisionedUser, signInAs } from '../../../support/web';

const OUT = process.env.HEIGHTS_OUT ?? '../.screenshots/control-heights.json';

const STATIC = [
  '/sessions',
  '/sessions/new',
  '/inbox',
  '/plan',
  '/plan/todo',
  '/plan/milestones',
  '/plan/projects',
  '/plan/calendar',
  '/plan/inbox',
  '/plan/open',
  '/pulls',
  '/pulls/review',
  '/pulls/analytics',
  '/automations',
  '/automations/routines',
  '/automations/runs',
  '/bots',
  '/settings/profile',
  '/settings/hosts',
  '/settings/hosts/new',
  '/settings/repositories',
  '/settings/agents',
  '/settings/cloud-agents',
  '/settings/model-providers',
  '/settings/memory',
  '/settings/mail',
  '/settings/telegram',
  '/settings/whatsapp',
  '/settings/about',
  '/about',
];

const BOT_TABS = ['profile', 'instructions', 'permissions', 'skills', 'routines', 'gateways', 'memory', 'runs-on', 'home-host'];

async function measure(page: Page, within?: string) {
  return page.evaluate((scope) => {
    const SELECTOR =
      'button, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, [role=combobox], [role=tab], [data-slot=input], [data-slot=facet-select], [data-slot=chip-select], [data-slot=pill-tab], [data-slot=segmented-control], [data-slot=date-picker], [data-slot=date-range-picker], a[data-slot=button]';
    const seen = new Set<Element>();
    const items: { el: Element; r: DOMRect }[] = [];
    for (const el of document.querySelectorAll(SELECTOR)) {
      // A field's inner <input> is measured through its shell.
      const shell = el.closest('[data-slot=input]');
      const target = shell && shell !== el ? shell : el;
      // A segmented control is measured as a whole track.
      const track = target.closest('[data-slot=segmented-control]');
      const unit = track ?? target;
      if (seen.has(unit)) continue;
      seen.add(unit);
      const r = unit.getBoundingClientRect();
      const style = getComputedStyle(unit);
      if (r.width < 12 || r.height < 12 || style.visibility === 'hidden' || r.bottom < 0) continue;
      if (unit.closest('[aria-hidden=true], [inert]')) continue;
      if (scope ? !unit.closest(scope) : unit.closest('[data-slot=sidebar], nav, [role=menu], [role=listbox], [role=dialog]'))
        continue;
      items.push({ el: unit, r });
    }
    const describe = (el: Element) => {
      const slot = el.getAttribute('data-slot');
      const variant = el.getAttribute('data-variant');
      const size = el.getAttribute('data-size');
      const name =
        el.getAttribute('aria-label') ||
        (el as HTMLInputElement).placeholder ||
        el.querySelector('input')?.getAttribute('placeholder') ||
        (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 28);
      return `${slot ?? el.tagName.toLowerCase()}${variant ? `:${variant}` : ''}${size ? `/${size}` : ''} "${name}"`;
    };
    // Siblings in one row: same nearest flex parent, centres within 6px.
    const rows = new Map<Element, { el: Element; r: DOMRect }[][]>();
    for (const item of items) {
      let parent = item.el.parentElement;
      while (parent && !getComputedStyle(parent).display.includes('flex')) parent = parent.parentElement;
      if (!parent) continue;
      // Climb while the parent is a thin wrapper around this control.
      let row = parent;
      for (let i = 0; i < 3 && row.parentElement; i++) {
        const pd = getComputedStyle(row.parentElement);
        if (!pd.display.includes('flex') || pd.flexDirection.startsWith('column')) break;
        row = row.parentElement;
      }
      if (getComputedStyle(row).flexDirection.startsWith('column')) continue;
      const groups = rows.get(row) ?? [];
      const mid = item.r.top + item.r.height / 2;
      const group = groups.find((g) => Math.abs(g[0].r.top + g[0].r.height / 2 - mid) < 6);
      if (group) group.push(item);
      else groups.push([item]);
      rows.set(row, groups);
    }
    const out: { heights: number[]; controls: string[] }[] = [];
    for (const groups of rows.values()) {
      for (const g of groups) {
        if (g.length < 2) continue;
        const heights = g.map((x) => Math.round(x.r.height * 2) / 2);
        if (Math.max(...heights) - Math.min(...heights) < 1) continue;
        out.push({ heights, controls: g.map((x) => `${Math.round(x.r.height * 2) / 2}px ${describe(x.el)}`) });
      }
    }
    // Every control height seen, for the census.
    const census: Record<string, number> = {};
    for (const { el, r } of items) {
      const key = `${Math.round(r.height * 2) / 2}px ${el.getAttribute('data-slot') ?? el.tagName.toLowerCase()}${el.getAttribute('data-variant') ? `:${el.getAttribute('data-variant')}` : ''}`;
      census[key] = (census[key] ?? 0) + 1;
    }
    return { rows: out, census };
  }, within ?? null);
}

test('control heights, row by row', async ({ page }) => {
  test.setTimeout(600_000);
  const owner = await provisionedUser('heights');
  await pairHost(owner.api, 'build-01');
  await signInAs(page, owner.user);
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.goto('/bots');
  await page.getByRole('button', { name: 'New bot', exact: true }).first().click();
  await page.waitForURL(/\/bots\/[0-9a-f-]{36}$/);
  const botId = page.url().split('/').pop() as string;

  // A plan with rows in it: a task due soon and one on today's TODO.
  const day = (offset: number) => {
    const date = new Date(Date.now() + offset * 86_400_000);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  await owner.api.post('/api/v1/tasks', { data: { title: 'Draft the launch post', dueDate: day(2) } });
  await owner.api.post('/api/v1/tasks', { data: { title: 'Migrate the queue', focusDate: day(0) } });

  const routes = [
    ...STATIC,
    `/bots/${botId}`,
    ...BOT_TABS.map((tab) => `/bots/${botId}/settings/${tab}`),
  ];
  const report: Record<string, unknown> = {};
  for (const route of routes) {
    await page.goto(route);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(800);
    report[route.replace(botId, ':botId')] = await measure(page);
  }
  // The routine editor's dialog: its step tabs and its trigger sentence.
  await page.goto('/automations');
  await page.getByRole('button', { name: 'New automation' }).click();
  await page.getByRole('dialog').waitFor();
  await page.waitForTimeout(600);
  report['/automations (New automation dialog)'] = await measure(page, '[role=dialog]');

  writeFileSync(OUT, JSON.stringify(report, null, 2));
});
