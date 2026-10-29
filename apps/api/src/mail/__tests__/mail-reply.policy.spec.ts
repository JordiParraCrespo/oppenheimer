import { addressesOf, formatAddress } from '../domain/mail-address.policy';
import {
  type AnsweredMessage,
  forwardSubject,
  referencesFor,
  replyRecipients,
  replySubject,
} from '../domain/mail-reply.policy';
import { dailyRefusal, recipientsRefusal, sizeRefusal } from '../domain/mail-send.policy';

/**
 * How an answer is addressed and threaded, and what a bot may send
 * (`product/next-steps/mail.md` §3.4): headers read into addresses with
 * quoted commas kept, a reply to the Reply-To or sender, a reply-all to
 * everyone but the person's own aliases, the References chain carried on,
 * and the recipient, daily and size limits at their edges.
 */
const message = (overrides: Partial<AnsweredMessage> = {}): AnsweredMessage => ({
  from: 'Bo Ruiz <bo@client.test>',
  to: 'Ana <ana@gmail.test>, Cy <cy@client.test>',
  cc: '"Díaz, Eva" <eva@client.test>, ana@work.test',
  replyTo: '',
  subject: 'Invoice 42',
  messageIdHeader: '<m2@client.test>',
  referencesHeader: '<m1@client.test>',
  ...overrides,
});

const emails = (addresses: { email: string }[]) => addresses.map((address) => address.email);

describe('mail addresses', () => {
  it('reads a header with a quoted comma as one address, and drops what is not an address', () => {
    expect(addressesOf('"Díaz, Eva" <eva@x.test>; bo@x.test, nobody, <bad@>')).toEqual([
      { name: 'Díaz, Eva', email: 'eva@x.test' },
      { name: null, email: 'bo@x.test' },
    ]);
  });

  it('quotes a name that a header would otherwise split', () => {
    expect(formatAddress({ name: 'Díaz, Eva', email: 'eva@x.test' })).toBe(
      '"Díaz, Eva" <eva@x.test>',
    );
    expect(formatAddress({ name: 'Bo', email: 'bo@x.test' })).toBe('Bo <bo@x.test>');
  });
});

describe('answers', () => {
  it('replies to the sender only, or to the Reply-To when one is set', () => {
    const own = ['ana@gmail.test', 'ana@work.test'];
    expect(replyRecipients(message(), own, false)).toEqual({
      to: [{ name: 'Bo Ruiz', email: 'bo@client.test' }],
      cc: [],
    });
    expect(
      emails(replyRecipients(message({ replyTo: 'billing@client.test' }), own, false).to),
    ).toEqual(['billing@client.test']);
  });

  it('replies to all without any of the person’s own aliases, and nobody twice', () => {
    const answer = replyRecipients(
      message({ cc: 'BO@client.test, eva@client.test, ana@work.test' }),
      ['ana@gmail.test', 'ana@work.test'],
      true,
    );
    expect(emails(answer.to)).toEqual(['bo@client.test']);
    expect(emails(answer.cc)).toEqual(['cy@client.test', 'eva@client.test']);
  });

  it('answers the person’s own sent message back to whom it went', () => {
    const sent = message({ from: 'ana@gmail.test', to: 'bo@client.test', cc: '' });
    expect(emails(replyRecipients(sent, ['ana@gmail.test'], false).to)).toEqual(['bo@client.test']);
  });

  it('adds Re: and Fwd: once, and carries the References chain on', () => {
    expect(replySubject('Invoice 42')).toBe('Re: Invoice 42');
    expect(replySubject('RE: Invoice 42')).toBe('RE: Invoice 42');
    expect(forwardSubject('Fw: Invoice 42')).toBe('Fw: Invoice 42');
    expect(forwardSubject('')).toBe('Fwd: (no subject)');
    expect(referencesFor(message())).toBe('<m1@client.test> <m2@client.test>');
  });
});

describe('send limits', () => {
  it('takes one to ten recipients, fewer than fifty sends a day, and 25 MB once encoded', () => {
    expect(recipientsRefusal(0)).not.toBeNull();
    expect(recipientsRefusal(10)).toBeNull();
    expect(recipientsRefusal(11)).not.toBeNull();
    expect(dailyRefusal(49)).toBeNull();
    expect(dailyRefusal(50)).not.toBeNull();
    expect(sizeRefusal(18 * 1024 * 1024, 0)).toBeNull();
    expect(sizeRefusal(19 * 1024 * 1024, 0)).not.toBeNull();
  });
});
