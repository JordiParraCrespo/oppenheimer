import { execSync } from 'node:child_process';
import { _electron as electron } from 'playwright-core';

const here = new URL('.', import.meta.url).pathname;
const clients = () =>
  execSync('tmux -L oppenheimer list-clients 2>/dev/null | wc -l').toString().trim();
const app = await electron.launch({
  executablePath: `${here}node_modules/electron/dist/electron`,
  args: [`${here}src/main.cjs`, '--no-sandbox'],
  env: { ...process.env },
});
const page = await app.firstWindow();
const url = `http://localhost:3000/sessions/${process.argv[2]}`;
await page.goto(url);
await page.locator('.xterm').first().waitFor({ timeout: 30000 });
await page.waitForTimeout(2500);
console.log('tmux clients, one page open:', clients());
for (let i = 0; i < 3; i++) {
  await page.reload();
  await page.locator('.xterm').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
}
console.log('tmux clients after 3 reloads:', clients());
await page.goto('http://localhost:3000/sessions/new');
await page.waitForTimeout(2500);
console.log('tmux clients after leaving the session:', clients());
await app.close();
await new Promise((r) => setTimeout(r, 1500));
console.log('tmux clients after quitting:', clients());
