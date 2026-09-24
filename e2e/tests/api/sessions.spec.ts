import { expect, test } from '@playwright/test';
import { expectProblemDocument, newContext, signedUpContext } from '../../support/auth';
import { titleFor } from '../../support/namer-stub';
import { connectInstallation, pairHost, STUB_REPOSITORIES } from '../../support/sessions';

/**
 * Sessions through the deployed pipeline.
 *
 * What this adds over the integration suite is the pipeline itself: the global
 * guards, the credential resolver, the Zod request pipe and the problem-document
 * filter all have to agree about a route whose policy is `update Session` behind
 * `sessions:write`. The state machine and the constraints are proved against a real
 * Postgres in `apps/api/test/sessions.integration.spec.ts`; what is proved here is
 * that a caller reaches them, and that another workspace does not.
 *
 * Creating a session needs a **host** and a **connected GitHub installation**.
 * Both are set up here through the real routes — minting a pairing token and
 * redeeming it the way a runner does, and connecting an installation the GitHub
 * stub serves (`support/sessions.ts`, and `e2e/README.md` for why there is a
 * stub at all). The refusals need no setup and always run.
 */

test.describe('Sessions', () => {
  test('a session is created, listed, stopped and keeps its log', async () => {
    // Pairing redeems a token at an IP-throttled route; see `pairHost`.
    test.slow();
    const { api } = await signedUpContext('sessionowner');

    const hostId = await pairHost(api, 'Session box');
    const installationId = await connectInstallation(api);

    const created = await api.post('/api/v1/sessions', {
      headers: { 'Idempotency-Key': `e2e-${Date.now()}` },
      data: {
        hostId,
        agent: 'claude-code',
        checkouts: [{ installationId, githubRepoId: STUB_REPOSITORIES.mobile.githubRepoId }],
      },
      failOnStatusCode: false,
    });
    expect(created.status(), await created.text()).toBe(201);
    const session = await created.json();

    // The slug is minted before anything is typed, because the directory and the
    // branch have to exist first; the name starts equal to it.
    expect(session.slug).toMatch(/^[a-z]+-[a-z]+-[0-9a-z]{6}$/);
    expect(session.name).toBe(session.slug);
    expect(session.lifecycle).toBe('starting');
    // No launch was asked for, so the level that asks before every action is
    // what was recorded — never one that escalates.
    expect(session.launch).toEqual({ model: null, permission: 'ask', effort: null });

    const listed = await api.get('/api/v1/sessions', { failOnStatusCode: false });
    expect(listed.status()).toBe(200);
    const page = await listed.json();
    expect(page.data.some((row: { id: string }) => row.id === session.id)).toBe(true);
    expect(page.meta.total).toBeGreaterThan(0);

    const stopped = await api.post(`/api/v1/sessions/${session.id}/stop`, {
      failOnStatusCode: false,
    });
    expect(stopped.status()).toBe(200);
    expect((await stopped.json()).stoppedAt, 'stopping is not closing').toBeTruthy();

    // The log is the truth per session, and `seq` is dense and the control plane's.
    const log = await api.get(`/api/v1/sessions/${session.id}/events`, { failOnStatusCode: false });
    expect(log.status()).toBe(200);
    const entries = (await log.json()).data as { seq: number; kind: string; source: string }[];
    expect(entries.map((entry) => entry.seq)).toEqual(
      Array.from({ length: entries.length }, (_, index) => index + 1),
    );
    expect(entries[0].kind).toBe('session.requested');
    expect(entries.some((entry) => entry.kind === 'session.stopped')).toBe(true);
    // One entry per action: a dispatcher that could not reach a host does not write
    // a second one beside it.
    expect(entries.filter((entry) => entry.kind === 'session.stopped')).toHaveLength(1);

    // Closing is a **request**: it has to push branches and remove worktrees, and
    // only the host can say that happened. So the lifecycle does not move — and
    // what it does not move *to* is the assertion, because where it stays
    // depends on whether a host ever answered. With no relay this session never
    // left `starting`; the rule is that closing did not resolve it.
    const closed = await api.delete(`/api/v1/sessions/${session.id}`, { failOnStatusCode: false });
    expect(closed.status()).toBe(200);
    expect((await closed.json()).lifecycle, 'closing is a request, not an outcome').not.toBe(
      'resolved',
    );

    const afterClose = await api.get(`/api/v1/sessions/${session.id}/events`, {
      failOnStatusCode: false,
    });
    const closing = (await afterClose.json()).data as { kind: string }[];
    expect(closing.some((entry) => entry.kind === 'session.close_requested')).toBe(true);
    expect(closing.some((entry) => entry.kind === 'session.closed')).toBe(false);
  });

  /**
   * What the New session screen sets, through the API rather than a browser.
   *
   * The browser spec (`tests/web/new-session.spec.ts`) proves the screen sends
   * it; this proves the route stores it — the launch on the row, the task in
   * the log, and a name derived from that task where a namer is configured.
   */
  test('the launch options and the first task survive the round trip', async () => {
    // Pairing redeems a token at an IP-throttled route; see `pairHost`.
    test.slow();
    const { api } = await signedUpContext('sessionlaunch');
    const hostId = await pairHost(api, 'Launch box');
    const installationId = await connectInstallation(api);

    const task = 'fix the wallet list empty state on mobile';
    const created = await api.post('/api/v1/sessions', {
      headers: { 'Idempotency-Key': `e2e-launch-${Date.now()}` },
      data: {
        hostId,
        agent: 'claude-code',
        checkouts: [
          {
            installationId,
            githubRepoId: STUB_REPOSITORIES.mobile.githubRepoId,
            baseBranch: 'release/2026-09',
          },
        ],
        launch: { model: 'opus', permission: 'auto', effort: 'high' },
        prompt: task,
      },
      failOnStatusCode: false,
    });
    expect(created.status(), await created.text()).toBe(201);
    const session = await created.json();

    expect(session.launch).toEqual({ model: 'opus', permission: 'auto', effort: 'high' });
    // Named within the create itself: the model is asked while the host is told,
    // and the response waits for its title (or the prompt's own words) rather
    // than leaving the slug for the next listing to replace.
    expect(session.name).toBe(titleFor(task));
    expect(session.checkouts[0].baseBranch).toBe('release/2026-09');
    // The base is what the session branched *from*; the session works on its own.
    expect(session.checkouts[0].branch).toContain(session.slug);

    // A fresh read, because the response is built from the aggregate and the row
    // is what a listing and a restart will read.
    const read = await api.get(`/api/v1/sessions/${session.id}`, { failOnStatusCode: false });
    expect((await read.json()).launch).toEqual({
      model: 'opus',
      permission: 'auto',
      effort: 'high',
    });

    const log = await api.get(`/api/v1/sessions/${session.id}/events`, {
      failOnStatusCode: false,
    });
    const entries = (await log.json()).data as {
      kind: string;
      payload: { text?: string; source?: string };
    }[];
    const prompt = entries.find((entry) => entry.kind === 'prompt.first');
    expect(prompt?.payload.text, 'the first task is the log’s, never a column').toBe(task);
    // The model's title, not the fallback from the prompt's words: the stub is up
    // and answers well inside the naming deadline.
    const named = entries.find((entry) => entry.kind === 'session.named');
    expect(named?.payload.source).toBe('model');
  });

  test('an anonymous caller cannot list or create sessions', async () => {
    const api = await newContext();

    expect((await api.get('/api/v1/sessions', { failOnStatusCode: false })).status()).toBe(401);
    expect(
      (
        await api.post('/api/v1/sessions', {
          data: { hostId: crypto.randomUUID(), agent: 'claude-code', checkouts: [] },
          failOnStatusCode: false,
        })
      ).status(),
    ).toBe(401);
  });

  test('a session id nobody owns answers as missing rather than forbidden', async () => {
    const { api } = await signedUpContext('sessionprobe');

    const detail = await api.get(`/api/v1/sessions/${crypto.randomUUID()}`, {
      failOnStatusCode: false,
    });

    // Confirming the id would make this endpoint an oracle for guessing them.
    await expectProblemDocument(detail, { status: 404, code: 'SESSIONS_001' });
  });

  test('a session with no repositories must name its project', async () => {
    const { api } = await signedUpContext('sessionnoproject');

    const created = await api.post('/api/v1/sessions', {
      data: { hostId: crypto.randomUUID(), agent: 'claude-code', checkouts: [] },
      failOnStatusCode: false,
    });

    // Zero checkouts is a real session — a project of notes needs no git at all —
    // but then nothing says which project's directory it belongs in.
    expect([400, 404]).toContain(created.status());
  });

  test('a body the schema refuses never reaches a handler', async () => {
    const { api } = await signedUpContext('sessionbadbody');

    const created = await api.post('/api/v1/sessions', {
      data: { hostId: 'not-a-uuid', agent: 'not-an-agent', checkouts: [] },
      failOnStatusCode: false,
    });

    expect(created.status()).toBe(400);
  });

  test('the same repository twice is refused by the schema', async () => {
    const { api } = await signedUpContext('sessiondupes');

    const created = await api.post('/api/v1/sessions', {
      data: {
        hostId: crypto.randomUUID(),
        agent: 'claude-code',
        checkouts: [
          { installationId: crypto.randomUUID(), githubRepoId: 1 },
          { installationId: crypto.randomUUID(), githubRepoId: 1 },
        ],
      },
      failOnStatusCode: false,
    });

    // A directory name is never reused inside a session, so one repository twice is
    // a body that cannot be satisfied — and it is a validation error rather than a
    // unique violation surfacing from the insert.
    expect(created.status()).toBe(400);
  });

  test('an image is handed to the host, and what is not an image is refused', async () => {
    // Pairing redeems a token at an IP-throttled route; see `pairHost`.
    test.slow();
    const { api } = await signedUpContext('sessionimage');
    const hostId = await pairHost(api, 'Image box');
    const installationId = await connectInstallation(api);
    const created = await api.post('/api/v1/sessions', {
      headers: { 'Idempotency-Key': `e2e-image-${Date.now()}` },
      data: {
        hostId,
        agent: 'claude-code',
        checkouts: [{ installationId, githubRepoId: STUB_REPOSITORIES.mobile.githubRepoId }],
      },
      failOnStatusCode: false,
    });
    expect(created.status(), await created.text()).toBe(201);
    const session = await created.json();
    const images = `/api/v1/sessions/${session.id}/images`;
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

    // The host was paired by redeeming a token, not by a runner dialling in, so
    // it holds no link: the image is accepted and nothing is owed later.
    const sent = await api.post(images, {
      multipart: { file: { name: 'shot.png', mimeType: 'image/png', buffer: png } },
      failOnStatusCode: false,
    });
    expect(sent.status(), await sent.text()).toBe(202);
    expect(await sent.json()).toEqual({ delivered: false, hints: ['host_offline'] });

    // The label is the browser's; the bytes are what count.
    await expectProblemDocument(
      await api.post(images, {
        multipart: {
          file: { name: 'shot.png', mimeType: 'image/png', buffer: Buffer.from('<svg/>') },
        },
        failOnStatusCode: false,
      }),
      { status: 415, code: 'SESSIONS_012' },
    );
    await expectProblemDocument(
      await api.post(images, { multipart: { window: '0' }, failOnStatusCode: false }),
      { status: 415, code: 'SESSIONS_012' },
    );

    await api.post(`/api/v1/sessions/${session.id}/stop`);
    await expectProblemDocument(
      await api.post(images, {
        multipart: { file: { name: 'shot.png', mimeType: 'image/png', buffer: png } },
        failOnStatusCode: false,
      }),
      { status: 409, code: 'SESSIONS_013' },
    );
  });
});
