// Flood a local session with output; watch the main process's memory and the end of the run.
import { _electron as electron } from 'playwright-core';

const here = new URL('.', import.meta.url).pathname;
const app = await electron.launch({
  executablePath: `${here}node_modules/electron/dist/electron`,
  args: [`${here}src/main.cjs`, '--no-sandbox'],
  env: { ...process.env },
});
const page = await app.firstWindow();
await page
  .evaluate(() => localStorage.setItem('oppenheimer.terminal.latency', '1'))
  .catch(() => {});
await page.goto(`http://localhost:3000/sessions/${process.argv[2]}`);
const term = page.locator('.xterm').first();
await term.waitFor({ timeout: 30000 });
await page.waitForTimeout(2500);
await term.click();
const rss = () => app.evaluate(() => Math.round(process.memoryUsage().rss / 1e6));
console.log('main rss before MB', await rss());
const t0 = Date.now();
await page.keyboard.type('seq 1 3000000; echo FLOOD-""DONE', { delay: 20 });
await page.keyboard.press('Enter');
let peak = 0;
for (;;) {
  peak = Math.max(peak, await rss());
  const text = await page.locator('.xterm-rows').first().innerText();
  if (text.includes('FLOOD-DONE')) break;
  if (Date.now() - t0 > 180000) {
    console.log('timeout');
    break;
  }
  await page.waitForTimeout(250);
}
console.log('done in s', (Date.now() - t0) / 1000, 'main rss peak MB', peak);
await page.keyboard.type('echo after-flood', { delay: 40 });
await page.keyboard.press('Enter');
await page.waitForTimeout(1000);
const text = await page.locator('.xterm-rows').first().innerText();
console.log('typing after flood:', text.split('after-flood').length > 2);
console.log(
  'readout',
  await page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter((e) => e.children.length === 0 && /^echo .*ms/.test(e.textContent ?? ''))
      .map((e) => e.textContent)
      .join(),
  ),
);
await page.screenshot({ path: `${here}shots/flood.png` });
await app.close();
