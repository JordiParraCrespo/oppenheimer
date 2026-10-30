import { mailPlanSchema } from '@oppenheimer/shared';
import type { GmailCallResolver } from '../application/gmail-call.resolver';
import { MailComposeResolver } from '../application/mail-compose.resolver';
import { GmailConnectionEntity } from '../domain/gmail-connection.entity';
import type { MailLocalFiles, MailRequest } from '../domain/mail-send.policy';
import type {
  GmailCallGrant,
  GmailMessage,
  GmailProviderPort,
} from '../infrastructure/gmail-provider.port';

/**
 * What a bot asks to write, planned and built (`product/next-steps/mail.md`
 * §3.4): the alias and its signature, a reply addressed and threaded from
 * the message it answers, a forward that carries the original's files, the
 * refusals (an alias the account lacks, too many recipients), and the RFC
 * 2822 message Gmail is handed, decoded back to prove what goes out. The
 * Gmail HTTP is the gateway's spec.
 */
const CONNECTION = GmailConnectionEntity.connect({
  organizationId: 'org-1',
  userId: 'owner-1',
  googleSubject: 'sub-1',
  accountEmail: 'ana@gmail.test',
  label: 'Personal',
  refreshTokenSealed: Buffer.from('sealed'),
  scopes: [],
});

const ORIGINAL: GmailMessage = {
  id: 'm1',
  threadId: 't1',
  from: 'Bo Ruiz <bo@client.test>',
  to: 'ana@gmail.test',
  cc: 'Cy <cy@client.test>',
  subject: 'Invoice 42',
  date: new Date('2026-10-28T09:00:00Z'),
  snippet: '',
  labelIds: ['INBOX'],
  attachments: [
    {
      attachmentId: 'a1',
      partId: '2',
      filename: 'factura.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 3,
    },
  ],
  bcc: '',
  replyTo: '',
  messageIdHeader: '<m1@client.test>',
  referencesHeader: '<m0@client.test>',
  dateHeader: 'Tue, 28 Oct 2026 09:00:00 +0000',
  body: 'Can you pay it?',
};

type Provider = Pick<GmailProviderPort, 'listSendAs' | 'readMessage' | 'readAttachment'>;

function setup() {
  const provider = {
    listSendAs: vi.fn(async () => [
      { email: 'ana@gmail.test', displayName: 'Ana', signatureHtml: '<b>Ana</b>', isDefault: true },
      { email: 'billing@acme.test', displayName: null, signatureHtml: '', isDefault: false },
    ]),
    readMessage: vi.fn(async () => ORIGINAL),
    readAttachment: vi.fn(async () => ({
      filename: 'factura.pdf',
      mimeType: 'application/pdf',
      bytes: Buffer.from('pdf'),
    })),
  } satisfies Provider;
  const grant: GmailCallGrant = { connectionId: CONNECTION.id, refreshToken: 'r' };
  const gmail = {
    call: async <T>(_c: unknown, run: (p: GmailProviderPort, g: GmailCallGrant) => Promise<T>) =>
      run(provider as unknown as GmailProviderPort, grant),
  } as unknown as GmailCallResolver;
  const compose = new MailComposeResolver(gmail);
  const build = async (request: Partial<MailRequest>, local: MailLocalFiles = new Map()) => {
    const plan = await compose.plan(CONNECTION, { ...REQUEST, ...request });
    const raw = await compose.build(provider as unknown as GmailProviderPort, grant, plan, local);
    return { plan, raw, mime: raw.raw.toString('utf8') };
  };
  return { compose, provider, build };
}

const REQUEST: MailRequest = {
  kind: 'new',
  messageId: null,
  to: [],
  cc: [],
  bcc: [],
  subject: null,
  body: 'Hello',
  from: null,
  signature: true,
  attachments: [],
  localFiles: [],
};

/** Every base64 part of a MIME message, decoded. */
function decodedParts(mime: string): string[] {
  return [...mime.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+)/g)].map(
    (match) => Buffer.from(match[1].replace(/\r\n/g, ''), 'base64').toString('utf8'),
  );
}

describe('MailComposeResolver', () => {
  it('replies in the thread, to the sender, with Re:, the quote, the signature and the References chain', async () => {
    const { build } = setup();

    const { plan, raw, mime } = await build({
      kind: 'reply',
      messageId: 'm1',
      body: '**Paid** today',
    });

    expect(plan).toMatchObject({
      from: { email: 'ana@gmail.test', name: 'Ana' },
      to: ['Bo Ruiz <bo@client.test>'],
      cc: [],
      recipientsFromMail: true,
      subject: 'Re: Invoice 42',
      threadId: 't1',
      attachments: [],
    });
    expect(raw.threadId).toBe('t1');
    expect(mime).toContain('In-Reply-To: <m1@client.test>');
    expect(mime).toContain('References: <m0@client.test> <m1@client.test>');
    const [text, html] = decodedParts(mime);
    expect(text).toContain('**Paid** today');
    expect(text).toContain('> Can you pay it?');
    expect(html).toContain('<strong>Paid</strong>');
    expect(html).toContain('<b>Ana</b>');
  });

  it('forwards with Fwd:, the original’s files and no thread', async () => {
    const { build, provider } = setup();

    const { plan, raw, mime } = await build({
      kind: 'forward',
      messageId: 'm1',
      to: ['Eva <eva@else.test>'],
      from: 'BILLING@acme.test',
    });

    expect(plan).toMatchObject({
      from: { email: 'billing@acme.test', name: null },
      subject: 'Fwd: Invoice 42',
      threadId: null,
      attachments: [{ source: 'mail', messageId: 'm1', partId: '2', filename: 'factura.pdf' }],
    });
    expect(raw.threadId).toBeNull();
    expect(mime).not.toContain('In-Reply-To');
    expect(mime).toContain('filename="factura.pdf"');
    expect(provider.readAttachment).toHaveBeenCalledWith(expect.anything(), 'm1', {
      attachmentId: null,
      partId: '2',
    });
    expect(decodedParts(mime)).toContain('pdf');
  });

  it('writes a header a sender tried to break as one line, and a non-ASCII subject as an encoded word', async () => {
    const { build } = setup();

    const { mime } = await build({
      to: ['bo@client.test'],
      subject: 'Factura pagada ✓\r\nBcc: everyone@evil.test',
    });

    expect(mime).not.toMatch(/^Bcc:/m);
    expect(mime).toMatch(/^Subject: =\?UTF-8\?B\?/m);
  });

  it('refuses an alias the account does not send from, and more than ten recipients', async () => {
    const { compose } = setup();

    await expect(
      compose.plan(CONNECTION, { ...REQUEST, to: ['bo@client.test'], from: 'ceo@acme.test' }),
    ).rejects.toMatchObject({ code: 'MAIL_013' });
    await expect(
      compose.plan(CONNECTION, {
        ...REQUEST,
        to: Array.from({ length: 11 }, (_, i) => `p${i}@client.test`),
      }),
    ).rejects.toMatchObject({ code: 'MAIL_010' });
    await expect(
      compose.plan(CONNECTION, { ...REQUEST, to: ['not an address'] }),
    ).rejects.toMatchObject({ code: 'MAIL_010' });
  });

  it('attaches an image from the bot’s chat with the bytes the write carries, and refuses one it was not given', async () => {
    const { build } = setup();
    const image = {
      source: 'chat' as const,
      attachmentId: '7c2f0d2e-4c39-4d8e-9a11-0f5b2b6f1a10',
      filename: 'receipt.png',
      mimeType: 'image/png',
      sizeBytes: 3,
    };

    const { plan, mime } = await build(
      { to: ['bo@client.test'], localFiles: [image] },
      new Map([[`chat:${image.attachmentId}`, Buffer.from('png')]]),
    );

    expect(plan.attachments).toEqual([image]);
    expect(mime).toContain('filename="receipt.png"');
    expect(decodedParts(mime)).toContain('png');
    await expect(build({ to: ['bo@client.test'], localFiles: [image] })).rejects.toMatchObject({
      code: 'MAIL_009',
    });
  });

  it('plans a draft with every recipient it carries, Bcc included, and holds it to the ten-recipient limit, a long body cut for its card', async () => {
    const { compose, provider } = setup();
    const draft = (to: string, bcc: string) => ({
      id: 'd1',
      message: { ...ORIGINAL, id: 'dm1', from: 'Ana <ana@gmail.test>', to, cc: '', bcc },
    });
    const withDraft = (read: ReturnType<typeof draft>) =>
      Object.assign(provider, { readDraft: vi.fn(async () => read) });

    withDraft(draft('bo@client.test', 'audit@acme.test'));
    await expect(compose.planDraft(CONNECTION, 'd1')).resolves.toMatchObject({
      kind: 'draft',
      to: ['bo@client.test'],
      bcc: ['audit@acme.test'],
      draftMessageId: 'dm1',
    });

    const long = {
      id: 'd1',
      message: { ...draft('bo@client.test', '').message, body: 'x'.repeat(150_000) },
    };
    withDraft(long);
    const plan = await compose.planDraft(CONNECTION, 'd1');
    expect(mailPlanSchema.safeParse(plan).success).toBe(true);
    expect(plan.body).toContain('it is sent whole');

    const many = Array.from({ length: 6 }, (_, i) => `p${i}@client.test`).join(', ');
    withDraft(draft(many, many));
    await expect(compose.planDraft(CONNECTION, 'd1')).rejects.toMatchObject({ code: 'MAIL_010' });
  });
});
