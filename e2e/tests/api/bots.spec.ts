import { randomUUID } from 'node:crypto';
import { type APIRequestContext, expect, test } from '@playwright/test';
import { expectProblemDocument, signedUpContext } from '../../support/auth';

/**
 * Bots through the deployed API (`product/versions/mvp/25-bots.md`, slice 1):
 * a blank bot created, renamed, grouped and given a home host; its soul and
 * instructions edited, refused over a stale revision and reverted; its memory
 * taught, reworded, forgotten and cleared; and the bot deleted with all of it.
 * Another workspace sees none of it. The workspace's model provider keys:
 * stored, replaced, never shown, forgotten; and a bot moved to another
 * provider. No runner is involved.
 */

interface Bot {
  id: string;
  name: string;
  avatarColor: string;
  groupId: string | null;
  position: number;
  homeHostId: string | null;
  provider: string;
  model: string | null;
  effort: string | null;
  permission: string;
  learnAutomatically: boolean;
  lastActivityAt: string;
}

interface BotDocument {
  name: 'soul' | 'instructions';
  content: string;
  revision: number;
  updatedBy: string;
}

async function ok<T>(response: Awaited<ReturnType<APIRequestContext['get']>>, status = 200) {
  expect(response.status(), await response.text()).toBe(status);
  return (status === 204 ? undefined : await response.json()) as T;
}

test.describe('Bots', () => {
  test('create, rename, group, edit documents, remember and delete a bot', async () => {
    test.setTimeout(120_000);
    const { api, userId } = await signedUpContext('bots');

    // A blank bot is "New Bot"; the second one is numbered.
    const first = await ok<Bot>(await api.post('/api/v1/bots', { data: {} }), 201);
    expect(first).toMatchObject({
      name: 'New Bot',
      groupId: null,
      position: 0,
      homeHostId: null,
      model: null,
      permission: 'auto',
      learnAutomatically: true,
    });
    const second = await ok<Bot>(await api.post('/api/v1/bots', { data: {} }), 201);
    expect(second).toMatchObject({ name: 'New Bot 2', position: 1 });
    expect(second.avatarColor).not.toBe(first.avatarColor);

    // Its documents: a soul that says its name, empty instructions, both revision 1.
    const documents = await ok<BotDocument[]>(await api.get(`/api/v1/bots/${first.id}/documents`));
    expect(documents.map((document) => [document.name, document.revision])).toEqual([
      ['soul', 1],
      ['instructions', 1],
    ]);
    expect(documents[0].content).toContain('You are New Bot.');
    expect(documents[1].content).toBe('');

    // Rename and choose a model and effort. A home host is only one the caller
    // may use: pairing a real one here would spend the address's registration
    // budget the hosts suite needs, so this asserts the refusal, and the
    // integration suite and the console's spec pick a paired host.
    const renamed = await ok<Bot>(
      await api.patch(`/api/v1/bots/${first.id}`, {
        data: {
          name: 'Release manager',
          description: 'Keeps the release notes honest.',
          model: 'claude-opus-5-5',
          effort: 'high',
          permission: 'full',
        },
      }),
    );
    expect(renamed).toMatchObject({
      name: 'Release manager',
      model: 'claude-opus-5-5',
      effort: 'high',
      permission: 'full',
      homeHostId: null,
    });
    await expectProblemDocument(
      await api.patch(`/api/v1/bots/${first.id}`, { data: { model: 'gpt-5.6-sol' } }),
      { status: 422, code: 'BOTS_010' },
    );
    await expectProblemDocument(
      await api.patch(`/api/v1/bots/${first.id}`, { data: { homeHostId: randomUUID() } }),
      { status: 404, code: 'HOSTS_001' },
    );

    // Group it; a second group with the same name in any case is refused.
    const group = await ok<{ id: string; name: string; position: number }>(
      await api.post('/api/v1/bot-groups', { data: { name: 'Engineering' } }),
      201,
    );
    await expectProblemDocument(
      await api.post('/api/v1/bot-groups', { data: { name: 'engineering' } }),
      { status: 409, code: 'BOTS_004' },
    );
    const grouped = await ok<Bot>(
      await api.patch(`/api/v1/bots/${second.id}`, { data: { groupId: group.id } }),
    );
    expect(grouped).toMatchObject({ groupId: group.id, position: 0 });
    const renamedGroup = await ok<{ name: string }>(
      await api.patch(`/api/v1/bot-groups/${group.id}`, { data: { name: 'Platform' } }),
    );
    expect(renamedGroup.name).toBe('Platform');
    const listedGroups = await ok<{ id: string }[]>(await api.get('/api/v1/bot-groups'));
    expect(listedGroups.map((g) => g.id)).toEqual([group.id]);

    // Instructions: saved over the revision read, refused over a stale one, reverted.
    const saved = await ok<BotDocument>(
      await api.put(`/api/v1/bots/${first.id}/documents/instructions`, {
        data: {
          content: 'Draft release notes every Thursday.',
          baseRevision: 1,
          note: 'first cut',
        },
      }),
    );
    expect(saved).toMatchObject({ revision: 2, updatedBy: 'user' });
    const stale = await expectProblemDocument(
      await api.put(`/api/v1/bots/${first.id}/documents/instructions`, {
        data: { content: 'Something else', baseRevision: 1 },
      }),
      { status: 409, code: 'BOTS_006' },
    );
    expect(stale.revision).toBe(2);
    await expectProblemDocument(
      await api.put(`/api/v1/bots/${first.id}/documents/readme`, {
        data: { content: 'x', baseRevision: 1 },
      }),
      { status: 404, code: 'BOTS_005' },
    );
    const reverted = await ok<BotDocument>(
      await api.post(`/api/v1/bots/${first.id}/documents/instructions/revisions/1/revert`),
    );
    expect(reverted).toMatchObject({ content: '', revision: 3 });
    const revisions = await ok<
      { revision: number; note: string; revertedFrom: number | null; authorUserId: string }[]
    >(await api.get(`/api/v1/bots/${first.id}/documents/instructions/revisions?limit=10`));
    expect(revisions.map((r) => [r.revision, r.note, r.revertedFrom])).toEqual([
      [3, '', 1],
      [2, 'first cut', null],
      [1, '', null],
    ]);
    expect(revisions.every((r) => r.authorUserId === userId)).toBe(true);
    await expectProblemDocument(
      await api.post(`/api/v1/bots/${first.id}/documents/instructions/revisions/9/revert`),
      { status: 404, code: 'BOTS_007' },
    );

    // Memory: taught, reworded, forgotten, cleared.
    const fact = await ok<{ id: string; content: string; source: string }>(
      await api.post(`/api/v1/bots/${first.id}/memory`, {
        data: { content: 'Releases go out on Thursdays.' },
      }),
      201,
    );
    expect(fact).toMatchObject({ content: 'Releases go out on Thursdays.', source: 'user' });
    await ok(
      await api.post(`/api/v1/bots/${first.id}/memory`, {
        data: { content: 'Staging is devbox.' },
      }),
      201,
    );
    const reworded = await ok<{ content: string }>(
      await api.patch(`/api/v1/bots/${first.id}/memory/${fact.id}`, {
        data: { content: 'Releases go out on Fridays.' },
      }),
    );
    expect(reworded.content).toBe('Releases go out on Fridays.');
    await ok(await api.delete(`/api/v1/bots/${first.id}/memory/${fact.id}`), 204);
    const remembered = await ok<{ content: string }[]>(
      await api.get(`/api/v1/bots/${first.id}/memory`),
    );
    expect(remembered.map((f) => f.content)).toEqual(['Staging is devbox.']);
    await ok(await api.delete(`/api/v1/bots/${first.id}/memory`), 204);
    expect(await ok<unknown[]>(await api.get(`/api/v1/bots/${first.id}/memory`))).toEqual([]);

    // Another workspace sees none of it.
    const { api: stranger } = await signedUpContext('botstranger');
    await expectProblemDocument(await stranger.get(`/api/v1/bots/${first.id}`), {
      status: 404,
      code: 'BOTS_001',
    });
    expect(await ok<Bot[]>(await stranger.get('/api/v1/bots'))).toEqual([]);
    await stranger.dispose();

    // Deleting the group ungroups its bot; deleting a bot removes it.
    await ok(await api.delete(`/api/v1/bot-groups/${group.id}`), 204);
    const afterGroup = await ok<Bot>(await api.get(`/api/v1/bots/${second.id}`));
    expect(afterGroup.groupId).toBeNull();
    await ok(await api.delete(`/api/v1/bots/${first.id}`), 204);
    await expectProblemDocument(await api.get(`/api/v1/bots/${first.id}/documents`), {
      status: 404,
      code: 'BOTS_001',
    });
    const remaining = await ok<Bot[]>(await api.get('/api/v1/bots'));
    expect(remaining.map((bot) => bot.id)).toEqual([second.id]);
    await api.dispose();
  });

  test('a workspace keeps one key per model provider, and never shows it', async () => {
    const { api } = await signedUpContext('botproviders');
    type Provider = {
      provider: string;
      configured: boolean;
      keyHint: string | null;
      isDefault: boolean;
    };
    const list = () => api.get('/api/v1/model-providers');

    const empty = await ok<Provider[]>(await list());
    expect(empty).toEqual([
      { provider: 'anthropic', configured: false, keyHint: null, updatedAt: null, isDefault: true },
      { provider: 'glm', configured: false, keyHint: null, updatedAt: null, isDefault: false },
      { provider: 'openai', configured: false, keyHint: null, updatedAt: null, isDefault: false },
    ]);

    const secret = `zai-${randomUUID()}-wxyz`;
    await ok(await api.put('/api/v1/model-providers/glm', { data: { apiKey: secret } }), 204);
    await ok(
      await api.put('/api/v1/model-providers/glm', { data: { apiKey: `${secret}-9876` } }),
      204,
    );
    const stored = await list();
    expect(await stored.text()).not.toContain(secret);
    const glm = (await ok<Provider[]>(stored)).find((row) => row.provider === 'glm');
    // The workspace's only key is the default until another is marked.
    expect(glm).toMatchObject({ configured: true, keyHint: '9876', isDefault: true });

    await expectProblemDocument(
      await api.put('/api/v1/model-providers/mistral', { data: { apiKey: secret } }),
      { status: 404, code: 'BOTS_012' },
    );

    // A new bot starts on the default provider, at its default model.
    const bot = await ok<Bot & { provider: string; model: string | null }>(
      await api.post('/api/v1/bots', { data: {} }),
      201,
    );
    expect(bot).toMatchObject({ provider: 'glm', model: null });

    // Only a provider with a key can be made the default.
    await expectProblemDocument(await api.put('/api/v1/model-providers/anthropic/default'), {
      status: 409,
      code: 'BOTS_017',
    });
    await ok(await api.put('/api/v1/model-providers/openai', { data: { apiKey: secret } }), 204);
    await ok(await api.put('/api/v1/model-providers/openai/default'), 204);
    const marked = await ok<Provider[]>(await list());
    expect(marked.filter((row) => row.isDefault).map((row) => row.provider)).toEqual(['openai']);
    const next = await ok<{ provider: string }>(await api.post('/api/v1/bots', { data: {} }), 201);
    expect(next.provider).toBe('openai');
    await ok(await api.delete('/api/v1/model-providers/openai'), 204);
    await expectProblemDocument(
      await api.patch(`/api/v1/bots/${bot.id}`, { data: { model: 'claude-opus-5-5' } }),
      { status: 422, code: 'BOTS_010' },
    );

    await ok(await api.delete('/api/v1/model-providers/glm'), 204);
    const after = await ok<Provider[]>(await list());
    expect(after.every((row) => !row.configured)).toBe(true);
    await api.dispose();
  });
});
