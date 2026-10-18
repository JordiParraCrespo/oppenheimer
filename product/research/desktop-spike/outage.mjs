// Attach locally, then run a disruption command, then type again and see if it lands.

import { execSync } from 'node:child_process';
import { _electron as electron } from 'playwright-core';

const here = new URL('.', import.meta.url).pathname;
const [sessionId, label, disrupt] = process.argv.slice(2);
const app = await electron.launch({
  executablePath: `${here}node_modules/electron/dist/electron`,
  args: [`${here}src/main.cjs`, '--no-sandbox'],
  env: { ...process.env },
});
const page = await app.firstWindow();
await page
  .evaluate(() => localStorage.setItem('oppenheimer.terminal.latency', '1'))
  .catch(() => {});
await page.goto(`http://localhost:3000/sessions/${sessionId}`);
const term = page.locator('.xterm').first();
await term.waitFor({ timeout: 30000 });
await page.waitForTimeout(2500);
await term.click();
const type = async (m) => {
  await page.keyboard.type(`echo ${m}`, { delay: 60 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
};
const seen = async (m) =>
  (await page.locator('.xterm-rows').first().innerText()).split(m).length > 2;
const readout = async () =>
  page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter((e) => e.children.length === 0 && /^echo .*ms/.test(e.textContent ?? ''))
      .map((e) => e.textContent)
      .join(),
  );
await type(`before-${label}`);
console.log('before:', await seen(`before-${label}`), await readout());
execSync(disrupt, { stdio: 'inherit', shell: '/bin/bash' });
await page.waitForTimeout(4000);
console.log(
  'during:',
  await readout(),
  (await page.locator('body').innerText())
    .match(/Live|Offline|Connecting|Reconnecting[^\n]*/g)
    ?.slice(-1),
);
const { existsSync } = await import('node:fs');
if (process.env.WAIT_FILE) {
  while (!existsSync(process.env.WAIT_FILE)) await page.waitForTimeout(500);
  await page.waitForTimeout(6000);
}
await type(`after-${label}`);
console.log('after:', await seen(`after-${label}`), await readout());
await page.screenshot({ path: `${here}shots/outage-${label}.png` });
await app.close();
