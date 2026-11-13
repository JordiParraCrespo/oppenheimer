import { type APIRequestContext, expect, request, test } from '@playwright/test';
import { API_URL } from '../../playwright.config';
import { getSession, signedUpContext } from '../../support/auth';

/** A token as an agent holds it (the MCP server, the CLI): pinned to the owner's workspace. */
async function tokenContext(api: APIRequestContext): Promise<APIRequestContext> {
  const { session } = (await (await getSession(api)).json()) as {
    session: { activeOrganizationId: string };
  };
  const minted = await api.post('/api/v1/tokens', {
    data: {
      name: 'agent',
      scopes: ['tasks:write'],
      organizationIds: [session.activeOrganizationId],
    },
  });
  expect(minted.status(), await minted.text()).toBe(201);
  const { token } = (await minted.json()) as { token: string };
  return request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}`, Origin: 'http://localhost:3000' },
  });
}

interface TaskRow {
  id: string;
  origin: 'person' | 'agent';
  triagedAt: string | null;
}

/**
 * A task an agent made waits in the Inbox until its person takes it up
 * (`product/versions/mvp/29-inbox.md`, "Tasks an agent made"), on the real
 * API: who made it is read off the credential, and only the person's own
 * request takes it up.
 */
test.describe('Tasks an agent made', () => {
  test('wait for the person, who takes them up with a TODO day or a dismissal; the agent cannot', async () => {
    const { api: owner } = await signedUpContext('agenttasks');
    const agent = await tokenContext(owner);
    const create = async (api: APIRequestContext, title: string) => {
      const created = await api.post('/api/v1/tasks', { data: { title } });
      expect(created.status(), await created.text()).toBe(201);
      return (await created.json()) as TaskRow;
    };

    const mine = await create(owner, 'Mine');
    expect(mine.origin).toBe('person');
    expect(mine.triagedAt).not.toBeNull();

    const planned = await create(agent, 'From the agent, planned');
    expect([planned.origin, planned.triagedAt]).toEqual(['agent', null]);

    // The agent giving it a TODO day, or dismissing it, leaves it waiting.
    const byAgent = await agent.patch(`/api/v1/tasks/${planned.id}`, {
      data: { focusDate: '2026-11-20' },
    });
    expect(((await byAgent.json()) as TaskRow).triagedAt).toBeNull();
    const agentDismiss = await agent.post(`/api/v1/tasks/${planned.id}/triage`);
    expect(((await agentDismiss.json()) as TaskRow).triagedAt).toBeNull();

    // The person giving it a TODO day takes it up.
    const byPerson = await owner.patch(`/api/v1/tasks/${planned.id}`, {
      data: { focusDate: '2026-11-21' },
    });
    expect(((await byPerson.json()) as TaskRow).triagedAt).not.toBeNull();

    // So does the person's dismissal, which changes nothing else.
    const dismissed = await create(agent, 'From the agent, dismissed');
    const answer = await owner.post(`/api/v1/tasks/${dismissed.id}/triage`);
    expect(answer.status(), await answer.text()).toBe(200);
    expect(await answer.json()).toMatchObject({
      origin: 'agent',
      status: 'todo',
      focusDate: null,
      triagedAt: expect.any(String),
    });

    await agent.dispose();
    await owner.dispose();
  });
});
