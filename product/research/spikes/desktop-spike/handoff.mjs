// One leg of "start at home, continue abroad". argv: <session> <home|abroad>.
// home: the desktop app (bridge on), starts a Python REPL and sets a variable.
// abroad: another device (no bridge, fresh profile, signs in), reads it back.

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron } from 'playwright-core';

const here = new URL('.', import.meta.url).pathname;
const account = JSON.parse(readFileSync(`${here}../account.json`, 'utf8'));
const [sessionId, leg] = process.argv.slice(2);
const abroad = leg === 'abroad';
const args = [`${here}src/main.cjs`, '--no-sandbox'];
if (abroad) args.push(`--user-data-dir=${mkdtempSync(join(tmpdir(), 'abroad-'))}`);
const env = { ...process.env };
if (abroad) env.OPPENHEIMER_NO_BRIDGE = '1';
const app = await electron.launch({
  executablePath: `${here}node_modules/electron/dist/electron`,
  args,
  env,
  timeout: 120000,
});
const page = await app.firstWindow();
page.setDefaultTimeout(120000);
const t0 = Date.now();
await page.goto('http://localhost:3000/login');
await page.waitForTimeout(3000);
if (new URL(page.url()).pathname.startsWith('/login')) {
  await page.getByLabel(/email/i).fill(account.email);
  await page
    .getByLabel(/password/i)
    .first()
    .fill(account.pw);
  await page
    .getByRole('button', { name: /sign in|log in|continue/i })
    .first()
    .click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}
await page.evaluate(() => localStorage.setItem('oppenheimer.terminal.latency', '1'));
await page.goto(`http://localhost:3000/sessions/${sessionId}`);
const term = page.locator('.xterm').first();
await term.waitFor();
await page.waitForTimeout(abroad ? 8000 : 2500);
console.log(leg, 'terminal up after s', (Date.now() - t0) / 1000);
await term.click();
const rows = () => page.locator('.xterm-rows').first().innerText();
const readout = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter((e) => e.children.length === 0 && /^echo .*ms/.test(e.textContent ?? ''))
      .map((e) => e.textContent)
      .join(),
  );
const typeLine = async (line, wait) => {
  await page.keyboard.type(line, { delay: 90 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(wait);
};
if (leg === 'home') {
  await typeLine('python3 -q', 2500);
  await typeLine('x = "set at home, " + __import__("time").strftime("%H:%M:%S")', 1500);
  await typeLine('n = 0', 1000);
  for (let i = 0; i < 20; i++) {
    await page.keyboard.type('n');
    await page.waitForTimeout(150);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(150);
  }
  console.log(leg, 'python started, x set:', (await rows()).includes('set at home'));
} else {
  console.log(leg, 'sees the home history:', (await rows()).includes('x = "set at home'));
  await typeLine('print(x)', 4000);
  for (let i = 0; i < 20; i++) {
    await page.keyboard.type('n');
    await page.waitForTimeout(700);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(700);
  }
  const text = await rows();
  console.log(
    leg,
    'print(x) ->',
    text
      .split('\n')
      .filter((l) => l.startsWith('set at home'))
      .pop() ?? '(not seen)',
  );
}
console.log(leg, 'readout:', await readout());
await page.screenshot({ path: `${here}shots/handoff-${leg}.png` });
await app.close();
