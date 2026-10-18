// Open a session in the desktop app, type into it, read the echo readout.

import { readFileSync } from 'node:fs';
import { _electron as electron } from 'playwright-core';

const here = new URL('.', import.meta.url).pathname;
const account = JSON.parse(readFileSync(`${here}../account.json`, 'utf8'));
const [sessionId, label] = process.argv.slice(2);
const app = await electron.launch({
  executablePath: `${here}node_modules/electron/dist/electron`,
  args: [`${here}src/main.cjs`, '--no-sandbox'],
  env: { ...process.env },
});
const page = await app.firstWindow();
await page.goto('http://localhost:3000/login');
await page.waitForTimeout(2000);
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
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
}
await page.evaluate(() => localStorage.setItem('oppenheimer.terminal.latency', '1'));
await page.goto(`http://localhost:3000/sessions/${sessionId}`);
const term = page.locator('.xterm').first();
await term.waitFor({ timeout: 30000 });
await page.waitForTimeout(2500);
await term.click();
const marker = `hello-${label}-${Date.now() % 100000}`;
await page.keyboard.type(`echo ${marker}`, { delay: 120 });
await page.keyboard.press('Enter');
await page.waitForTimeout(1000);
// 30 quiet single keystrokes so the readout has samples, then erase them.
for (let i = 0; i < 30; i++) {
  await page.keyboard.type('x');
  await page.waitForTimeout(150);
}
for (let i = 0; i < 30; i++) {
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(150);
}
await page.waitForTimeout(800);
const text = await page.locator('.xterm-rows').first().innerText();
console.log(label, 'output seen:', text.includes(marker) && text.split(marker).length > 2);
const readout = await page.evaluate(() => {
  const all = [...document.querySelectorAll('*')].filter(
    (e) => e.children.length === 0 && /echo .*ms|p50|relay|direct|local/i.test(e.textContent ?? ''),
  );
  return all
    .map((e) => e.textContent.trim())
    .filter((t) => t.length < 80)
    .slice(0, 5);
});
console.log(label, 'readout:', JSON.stringify(readout));
await page.screenshot({ path: `${here}shots/terminal-${label}.png` });
await app.close();
