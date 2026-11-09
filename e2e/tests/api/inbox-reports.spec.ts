import { type APIRequestContext, expect, request, test } from '@playwright/test';
import { API_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';

/** A 1×1 PNG: the smallest file the API's sniffing still calls an image. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

async function tokenContext(api: APIRequestContext, scopes: string[]): Promise<APIRequestContext> {
  const minted = await api.post('/api/v1/tokens', { data: { name: 'routine', scopes } });
  const { token } = (await minted.json()) as { token: string };
  return request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}`, Origin: 'http://localhost:3000' },
  });
}

/**
 * The loop an unattended agent and its owner close through the Inbox
 * (`product/versions/mvp/29-inbox.md`, "Reports"), on the real API: the agent
 * holds only the two report scopes.
 */
test.describe('Inbox reports', () => {
  test('an agent sends a problem with a picture, the owner answers, the agent reads the answer', async () => {
    const { api: owner } = await signedUpContext('reports');
    const agent = await tokenContext(owner, ['inbox-reports:read', 'inbox-reports:write']);

    const posted = await agent.post('/api/v1/inbox/reports', {
      multipart: {
        title: 'Sign-up is blank on a phone',
        body: 'Fix it, or is this known?',
        source: 'qa-explorer',
        images: { name: 'shot.png', mimeType: 'image/png', buffer: PNG },
      },
    });
    expect(posted.status(), await posted.text()).toBe(201);
    const report = (await posted.json()) as { id: string; images: { id: string }[] };
    expect(report.images).toHaveLength(1);

    const listed = await owner.get('/api/v1/inbox/reports');
    expect(((await listed.json()) as { id: string }[]).map((item) => item.id)).toContain(report.id);

    const picture = await owner.get(
      `/api/v1/inbox/reports/${report.id}/images/${report.images[0].id}/content`,
    );
    expect(picture.headers()['content-type']).toBe('image/png');
    expect((await picture.body()).equals(PNG)).toBe(true);

    const answered = await owner.post(`/api/v1/inbox/reports/${report.id}/answer`, {
      data: { text: 'Fix it, with a test at phone width.' },
    });
    expect(answered.status(), await answered.text()).toBe(200);

    const read = await agent.get(`/api/v1/inbox/reports/${report.id}`);
    expect(await read.json()).toMatchObject({
      status: 'answered',
      answer: 'Fix it, with a test at phone width.',
    });
    const open = await owner.get('/api/v1/inbox/reports');
    expect(((await open.json()) as { id: string }[]).map((item) => item.id)).not.toContain(
      report.id,
    );
  });

  test('the agent that asked cannot answer its own report', async () => {
    const { api: owner } = await signedUpContext('reports-self');
    const agent = await tokenContext(owner, ['inbox-reports:read', 'inbox-reports:write']);
    const posted = await agent.post('/api/v1/inbox/reports', { multipart: { title: 'May I?' } });
    const { id } = (await posted.json()) as { id: string };

    const answered = await agent.post(`/api/v1/inbox/reports/${id}/answer`, {
      data: { text: 'Yes.' },
      failOnStatusCode: false,
    });

    expect(answered.status()).toBe(403);
    expect(await (await agent.get(`/api/v1/inbox/reports/${id}`)).json()).toMatchObject({
      status: 'open',
      answer: null,
    });
  });

  test('a file that is not an image is refused, whatever it is called', async () => {
    const { api: owner } = await signedUpContext('reports-type');
    const posted = await owner.post('/api/v1/inbox/reports', {
      multipart: {
        title: 'A script',
        images: { name: 'shot.png', mimeType: 'image/png', buffer: Buffer.from('#!/bin/sh\n') },
      },
      failOnStatusCode: false,
    });

    expect(posted.status()).toBe(415);
    expect(((await posted.json()) as { code: string }).code).toBe('INBOX_009');
  });
});
