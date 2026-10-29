import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GmailGateway } from '../infrastructure/gmail.gateway';
import { GmailGrantRevokedError, GmailNotFoundError } from '../infrastructure/gmail-provider.port';

/**
 * Gmail is the one system the mail tools read, at the moment a bot asks.
 * These pin what a bot's answer depends on: a search reads the envelopes and
 * files without the bodies, a body comes back as text in its own charset,
 * Google's quota pauses the right bucket instead of being asked again, and a
 * dropped grant reads as one, not as Gmail being down.
 */

const CONFIG: Record<string, string> = {
  'mail.googleAuthUrl': 'https://accounts.example.test/o/oauth2/v2/auth',
  'mail.googleOauthBaseUrl': 'https://oauth2.example.test',
  'mail.gmailApiBaseUrl': 'https://gmail.example.test',
  'oauth.google.clientId': 'client',
  'oauth.google.clientSecret': 'secret',
  'app.frontendUrl': 'https://console.example.test',
};

const config = {
  get: (key: string) => CONFIG[key],
  getOrThrow: (key: string) => CONFIG[key],
} as unknown as ConfigService;

const ANA = { connectionId: 'c-ana', refreshToken: '1//ana' };
const BEN = { connectionId: 'c-ben', refreshToken: '1//ben' };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

const TOKEN = () => json(200, { access_token: 'ya29.token' });
const b64 = (text: string, encoding: BufferEncoding = 'utf8') =>
  Buffer.from(text, encoding).toString('base64url');

const INVOICE = {
  id: 'm1',
  threadId: 't1',
  labelIds: ['INBOX', 'UNREAD'],
  snippet: 'Your invoice &amp; receipt',
  internalDate: '1793000000000',
  payload: {
    partId: '',
    mimeType: 'multipart/mixed',
    headers: [
      { name: 'From', value: 'Acme Billing <billing@acme.test>' },
      { name: 'To', value: 'ana@gmail.test' },
      { name: 'Subject', value: 'Invoice 42' },
    ],
    parts: [
      { partId: '0', mimeType: 'text/plain', filename: '', body: { size: 12 } },
      {
        partId: '1',
        mimeType: 'application/pdf',
        filename: 'invoice-42.pdf',
        body: { size: 52_000, attachmentId: 'att-1' },
      },
    ],
  },
};

afterEach(() => vi.unstubAllGlobals());

describe('GmailGateway', () => {
  it('asks for every scope a bot needs, offline, with the account chooser, back to the console', () => {
    const url = new URL(new GmailGateway(config).authorizationUrl('state-1', 'ana@gmail.test'));
    expect(url.searchParams.get('scope')).toBe(
      'openid email https://www.googleapis.com/auth/gmail.modify',
    );
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent select_account');
    expect(url.searchParams.get('login_hint')).toBe('ana@gmail.test');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://console.example.test/settings/mail/google',
    );
  });

  it('searches with Gmail’s query and reads each result’s envelope and files, never its body', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(TOKEN())
      .mockResolvedValueOnce(
        json(200, { messages: [{ id: 'm1', threadId: 't1' }], resultSizeEstimate: 7 }),
      )
      .mockResolvedValueOnce(json(200, INVOICE));
    vi.stubGlobal('fetch', fetch);

    const page = await new GmailGateway(config).search(ANA, {
      query: 'from:acme has:attachment',
      maxResults: 10,
      pageToken: null,
      includeSpamTrash: false,
    });

    const list = new URL(fetch.mock.calls[1][0]);
    expect(list.pathname).toBe('/gmail/v1/users/me/messages');
    expect(list.searchParams.get('q')).toBe('from:acme has:attachment');
    const get = new URL(fetch.mock.calls[2][0]);
    expect(get.searchParams.get('fields')).not.toMatch(/body\/data|,data/);
    expect(page.resultSizeEstimate).toBe(7);
    expect(page.messages[0]).toMatchObject({
      id: 'm1',
      threadId: 't1',
      from: 'Acme Billing <billing@acme.test>',
      subject: 'Invoice 42',
      snippet: 'Your invoice & receipt',
      labelIds: ['INBOX', 'UNREAD'],
      attachments: [
        {
          attachmentId: 'att-1',
          partId: '1',
          filename: 'invoice-42.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 52_000,
        },
      ],
    });
  });

  it('reads a thread’s bodies as text, in each part’s charset, and HTML as text when there is no plain part', async () => {
    const latin = {
      ...INVOICE,
      payload: {
        mimeType: 'text/plain',
        headers: [
          { name: 'Subject', value: 'Café' },
          { name: 'Content-Type', value: 'text/plain; charset="ISO-8859-1"' },
        ],
        body: { data: b64('Caf\xe9 a las 9', 'latin1') },
      },
    };
    const html = {
      ...INVOICE,
      id: 'm2',
      payload: {
        mimeType: 'multipart/alternative',
        headers: [],
        parts: [
          {
            mimeType: 'text/html',
            headers: [],
            body: {
              data: b64(
                '<html><head><style>p{}</style></head><p>Hola&nbsp;Ana</p><p>Bye</p></html>',
              ),
            },
          },
        ],
      },
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(TOKEN())
        .mockResolvedValueOnce(json(200, { id: 't1', messages: [latin, html] })),
    );

    const thread = await new GmailGateway(config).readThread(ANA, 't1');

    expect(thread.messages.map((message) => message.body)).toEqual([
      'Café a las 9',
      'Hola Ana\nBye',
    ]);
  });

  it('pauses an account Google refused for its own quota, and only that account', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(TOKEN())
      .mockResolvedValueOnce(
        json(429, { error: { errors: [{ reason: 'userRateLimitExceeded' }] } }),
      )
      .mockResolvedValueOnce(TOKEN())
      .mockResolvedValueOnce(json(200, { labels: [] }));
    vi.stubGlobal('fetch', fetch);
    const gateway = new GmailGateway(config);

    await expect(gateway.listLabels(ANA)).rejects.toMatchObject({ code: 'MAIL_008' });
    await expect(gateway.listLabels(ANA)).rejects.toMatchObject({ code: 'MAIL_008' });
    await expect(gateway.listLabels(BEN)).resolves.toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('reads a dropped grant as revoked and a missing thread as not found', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json(400, { error: 'invalid_grant' }))
        .mockResolvedValueOnce(TOKEN())
        .mockResolvedValueOnce(json(404, { error: { code: 404 } })),
    );
    const gateway = new GmailGateway(config);

    await expect(gateway.readThread(ANA, 't1')).rejects.toBeInstanceOf(GmailGrantRevokedError);
    await expect(gateway.readThread(ANA, 'gone')).rejects.toBeInstanceOf(GmailNotFoundError);
  });

  it('fetches an attachment’s bytes by its part, through its attachment id', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(TOKEN())
      .mockResolvedValueOnce(json(200, INVOICE))
      .mockResolvedValueOnce(json(200, { data: b64('%PDF-1.7') }));
    vi.stubGlobal('fetch', fetch);

    const file = await new GmailGateway(config).readAttachment(ANA, 'm1', {
      attachmentId: null,
      partId: '1',
    });

    expect(new URL(fetch.mock.calls[2][0]).pathname).toBe(
      '/gmail/v1/users/me/messages/m1/attachments/att-1',
    );
    expect(file).toEqual({
      filename: 'invoice-42.pdf',
      mimeType: 'application/pdf',
      bytes: Buffer.from('%PDF-1.7'),
    });
  });

  it('sends the raw message base64url in its thread, and reads back Gmail’s ids', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(TOKEN())
      .mockResolvedValueOnce(json(200, { id: 'g1', threadId: 't1' }));
    vi.stubGlobal('fetch', fetch);

    const sent = await new GmailGateway(config).sendMessage(ANA, {
      raw: Buffer.from('Subject: Hi\r\n\r\nÉ?'),
      threadId: 't1',
    });

    const [url, init] = fetch.mock.calls[1];
    expect(new URL(url).pathname).toBe('/gmail/v1/users/me/messages/send');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      raw: Buffer.from('Subject: Hi\r\n\r\nÉ?').toString('base64url'),
      threadId: 't1',
    });
    expect(sent).toEqual({ messageId: 'g1', threadId: 't1' });
  });

  it('pauses only the account when Gmail refuses a send for its sending limit', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(TOKEN())
      .mockResolvedValueOnce(json(429, { error: { errors: [{ reason: 'rateLimitExceeded' }] } }))
      .mockResolvedValueOnce(TOKEN())
      .mockResolvedValueOnce(json(200, { labels: [] }));
    vi.stubGlobal('fetch', fetch);
    const gateway = new GmailGateway(config);

    await expect(
      gateway.sendMessage(ANA, { raw: Buffer.from('x'), threadId: null }),
    ).rejects.toMatchObject({ code: 'MAIL_008' });
    await expect(gateway.listLabels(BEN)).resolves.toEqual([]);
  });

  it('deletes a draft, reading Gmail’s empty answer as done', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(TOKEN())
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);

    await expect(new GmailGateway(config).deleteDraft(ANA, 'd1')).resolves.toBeUndefined();

    const [url, init] = fetch.mock.calls[1];
    expect(new URL(url).pathname).toBe('/gmail/v1/users/me/drafts/d1');
    expect(init.method).toBe('DELETE');
  });

  it('changes threads one by one, says which Gmail does not have, and batches messages', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(TOKEN())
      .mockResolvedValueOnce(json(200, { id: 't1' }))
      .mockResolvedValueOnce(json(404, { error: { code: 404 } }))
      .mockResolvedValueOnce(json(200, { id: 't3' }))
      .mockResolvedValueOnce(TOKEN())
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    const gateway = new GmailGateway(config);
    const change = { add: ['STARRED'], remove: ['UNREAD'] };

    await expect(gateway.modifyThreads(ANA, ['t1', 'gone', 't3'], change)).resolves.toEqual({
      changed: ['t1', 't3'],
      missing: ['gone'],
    });
    await gateway.modifyMessages(ANA, ['m1', 'm2'], change);

    expect(new URL(fetch.mock.calls[1][0]).pathname).toBe('/gmail/v1/users/me/threads/t1/modify');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      addLabelIds: ['STARRED'],
      removeLabelIds: ['UNREAD'],
    });
    expect(new URL(fetch.mock.calls[5][0]).pathname).toBe(
      '/gmail/v1/users/me/messages/batchModify',
    );
    expect(JSON.parse(fetch.mock.calls[5][1].body)).toEqual({
      ids: ['m1', 'm2'],
      addLabelIds: ['STARRED'],
      removeLabelIds: ['UNREAD'],
    });
  });

  it('moves threads to Trash and back by their own endpoints', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(TOKEN())
      .mockResolvedValueOnce(json(200, { id: 't1' }))
      .mockResolvedValueOnce(TOKEN())
      .mockResolvedValueOnce(json(200, { id: 't1' }));
    vi.stubGlobal('fetch', fetch);
    const gateway = new GmailGateway(config);

    await gateway.trashThreads(ANA, ['t1'], true);
    await gateway.trashThreads(ANA, ['t1'], false);

    expect(new URL(fetch.mock.calls[1][0]).pathname).toBe('/gmail/v1/users/me/threads/t1/trash');
    expect(new URL(fetch.mock.calls[3][0]).pathname).toBe('/gmail/v1/users/me/threads/t1/untrash');
  });

  it('reads new mail from a history id across pages, leaves out drafts and sent mail, and moves the mark', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(TOKEN())
      .mockResolvedValueOnce(
        json(200, {
          history: [
            {
              id: '101',
              messagesAdded: [{ message: { id: 'm1', labelIds: ['INBOX', 'UNREAD'] } }],
            },
            { id: '102', messagesAdded: [{ message: { id: 'd1', labelIds: ['DRAFT'] } }] },
          ],
          nextPageToken: 'p2',
          historyId: '200',
        }),
      )
      .mockResolvedValueOnce(
        json(200, {
          history: [
            {
              id: '103',
              messagesAdded: [
                { message: { id: 's1', labelIds: ['SENT'] } },
                { message: { id: 'm2', labelIds: ['INBOX'] } },
              ],
            },
          ],
          historyId: '200',
        }),
      );
    vi.stubGlobal('fetch', fetch);

    const mail = await new GmailGateway(config).newMessages(ANA, '100', 50);

    expect(mail).toEqual({ messageIds: ['m1', 'm2'], historyId: '200' });
    const first = new URL(fetch.mock.calls[1][0]);
    expect(first.pathname).toBe('/gmail/v1/users/me/history');
    expect(first.searchParams.get('startHistoryId')).toBe('100');
    expect(first.searchParams.get('historyTypes')).toBe('messageAdded');
    expect(new URL(fetch.mock.calls[2][0]).searchParams.get('pageToken')).toBe('p2');
  });

  it('stops at its cap where it stopped, and answers null for history Gmail no longer keeps', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(TOKEN())
      .mockResolvedValueOnce(
        json(200, {
          history: [
            { id: '101', messagesAdded: [{ message: { id: 'm1', labelIds: ['INBOX'] } }] },
            { id: '102', messagesAdded: [{ message: { id: 'm2', labelIds: ['INBOX'] } }] },
          ],
          historyId: '300',
        }),
      )
      .mockResolvedValueOnce(TOKEN())
      .mockResolvedValueOnce(json(404, { error: { code: 404 } }));
    vi.stubGlobal('fetch', fetch);
    const gateway = new GmailGateway(config);

    await expect(gateway.newMessages(ANA, '100', 1)).resolves.toEqual({
      messageIds: ['m1'],
      historyId: '101',
    });
    await expect(gateway.newMessages(ANA, '1', 50)).resolves.toBeNull();
  });

  it('reads a message whole for an answer or a forward, where a thread read for a bot is cut', async () => {
    const long = 'x'.repeat(9_000);
    const withBody = {
      ...INVOICE,
      payload: {
        partId: '',
        mimeType: 'text/plain',
        filename: '',
        headers: [...INVOICE.payload.headers, { name: 'Bcc', value: 'audit@acme.test' }],
        body: { size: long.length, data: b64(long) },
      },
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(TOKEN())
        .mockResolvedValueOnce(json(200, withBody))
        .mockResolvedValueOnce(TOKEN())
        .mockResolvedValueOnce(json(200, { id: 't1', messages: [withBody] })),
    );
    const gateway = new GmailGateway(config);

    const whole = await gateway.readMessage(ANA, 'm1');
    const thread = await gateway.readThread(ANA, 't1');

    expect(whole.body).toBe(long);
    expect(whole.bcc).toBe('audit@acme.test');
    expect(thread.messages[0].body).toContain('was cut');
  });
});
