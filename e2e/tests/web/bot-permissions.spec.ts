import { expect, test } from '@playwright/test';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * A bot's Settings → Permissions in a browser, against the real control
 * plane (`product/versions/mvp/25-bots.md` §5): the tools folded under their
 * groups and found by a search kept in the address, each standing where the
 * preset puts it; one set Off, found under the Decision dropdown's Set by
 * you and handed back to the preset, then shown alone under the Group
 * dropdown's GitHub; merging never offered Allow; and a rule of each kind
 * written and removed. What a yes with a reach leaves standing is the API's
 * integration suite: no bot runs a turn here.
 */
test('a bot’s tools set and reset, and its rules written and removed', async ({ page }) => {
  const owner = await provisionedUser('bot-permissions');
  const bot = (await (
    await owner.api.post('/api/v1/bots', { data: { name: 'Juno', provider: 'glm' } })
  ).json()) as { id: string };
  await signInAs(page, owner.user);

  await page.goto(`/bots/${bot.id}/settings/permissions`);
  await expect(page.getByRole('heading', { name: 'Permissions', level: 1 })).toBeVisible();
  await expect(page.getByText(/follow Approve for me/)).toBeVisible();
  await expect(
    page.getByText('Nothing yet. “Always allow for …” on a request adds it here.'),
  ).toBeVisible();

  // The tools open folded; a search opens the group that holds a match.
  const comment = page.getByRole('group', { name: 'What comment_on_pull_request does' });
  await expect(comment).toBeHidden();
  const search = page.getByRole('searchbox', { name: 'Search tools' });
  await search.fill('comment on pull');
  await expect(page).toHaveURL(/q=comment/);

  // An outside tool asks under Approve for me; Off takes it away, Default gives it back.
  await expect(comment.getByRole('button', { name: 'Ask' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await comment.getByRole('button', { name: 'Off' }).click();
  await expect(comment.getByRole('button', { name: 'Off' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Set by you lists that one tool, and keeps it in the address.
  await search.fill('');
  const decision = page.getByRole('button', { name: /^Decision/ });
  await decision.click();
  await page.getByRole('menuitemradio', { name: /^Set by you/ }).click();
  await expect(page).toHaveURL(/decision=changed/);
  await expect(page.getByRole('group', { name: /^What .* does$/ })).toHaveCount(1);
  const row = page.locator('[data-slot="settings-row"]').filter({ has: comment });
  await row.getByRole('button', { name: 'Default' }).click();
  await expect(page.getByText('No tools match.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page).not.toHaveURL(/decision=/);

  // The GitHub group alone, with the comment tool back on Ask.
  await page.getByRole('button', { name: /^Group/ }).click();
  await page.getByRole('menuitemradio', { name: /^GitHub/ }).click();
  await expect(page).toHaveURL(/group=github/);
  await expect(comment.getByRole('button', { name: 'Ask' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(row.getByRole('button', { name: 'Default' })).toHaveCount(0);

  // A merge is decided call by call: Allow is not offered.
  await search.fill('merge_pull');
  const merge = page.getByRole('group', { name: 'What merge_pull_request does' });
  await expect(merge.getByRole('button', { name: 'Allow' })).toBeDisabled();

  // A rule of each kind, then one removed.
  await page.getByRole('textbox', { name: 'New ask rule' }).fill('It mentions payments');
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();
  await expect(page.getByText('It mentions payments', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'New allow rule' }).fill('It comments on our docs');
  await page.getByRole('button', { name: 'Add', exact: true }).nth(1).click();
  await expect(page.getByText('It comments on our docs', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove the rule “It mentions payments”' }).click();
  await expect(page.getByText('It mentions payments', { exact: true })).toHaveCount(0);

  const saved = (await (await owner.api.get(`/api/v1/bots/${bot.id}/permissions`)).json()) as {
    rules: { effect: string; text: string }[];
  };
  expect(saved.rules).toEqual([
    expect.objectContaining({ effect: 'allow', text: 'It comments on our docs' }),
  ]);

  await owner.api.dispose();
});
