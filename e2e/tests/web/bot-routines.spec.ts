import { expect, test } from '@playwright/test';
import { insertBotRoutine, routinePausedAt } from '../../support/db';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * A bot's Routines tab in a browser, against the real control plane
 * (`product/versions/mvp/26-bot-routines.md` §7). The chat is where a
 * routine is made, through the bot's own tool and a real model, so the
 * routine is seeded; what is under test is the tab: the card reads the
 * routine, the switch pauses and resumes it on the server, Edit hands the
 * change to the chat with the routine named, and Delete takes it away.
 */

test("a bot's routine on its Routines tab, from the card to Delete", async ({ page }) => {
  const owner = await provisionedUser('botroutines');
  await owner.api.put('/api/v1/model-providers/glm', { data: { apiKey: 'e2e-placeholder' } });
  const bot = (await (
    await owner.api.post('/api/v1/bots', { data: { name: 'Juno', provider: 'glm' } })
  ).json()) as { id: string };
  await signInAs(page, owner.user);

  // With none, the tab says what a routine is and sends you to the chat.
  await page.goto(`/bots/${bot.id}/settings/routines`);
  await expect(page.getByText(/Ask it in chat to set one up/)).toBeVisible();

  const routineId = await insertBotRoutine(
    bot.id,
    'Morning PR digest',
    'List the open pull requests.',
  );
  await page.reload();
  const card = page.locator('[data-slot="routine-card"]').filter({ hasText: 'Morning PR digest' });
  await expect(card).toContainText('Schedule · Daily at 09:00');
  await expect(card).toContainText('List the open pull requests.');

  // The switch pauses it on the server, and turns it back on.
  await card.getByRole('switch', { name: 'On' }).click();
  await expect(card).toHaveAttribute('data-paused', 'true');
  await expect.poll(() => routinePausedAt(routineId)).not.toBeNull();
  await card.getByRole('switch', { name: 'On' }).click();
  await expect(card).not.toHaveAttribute('data-paused', 'true');
  await expect.poll(() => routinePausedAt(routineId)).toBeNull();

  // Edit goes to the chat, the routine named in the composer.
  await card.getByRole('button', { name: 'Edit in chat' }).click();
  await expect(page).toHaveURL(new RegExp(`/bots/${bot.id}$`));
  await expect(page.getByPlaceholder('Message Juno')).toHaveValue(
    'Edit your routine: Morning PR digest',
  );

  // Delete asks first, then the tab is empty again.
  await page.goto(`/bots/${bot.id}/settings/routines`);
  await card.getByRole('button', { name: 'Delete routine' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Delete “Morning PR digest”?' });
  await confirm.getByRole('button', { name: 'Delete routine' }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByText(/Ask it in chat to set one up/)).toBeVisible();
});
