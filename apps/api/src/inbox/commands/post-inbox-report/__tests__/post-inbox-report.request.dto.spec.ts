import { ZodValidationPipe } from 'nestjs-zod';
import { PostInboxReportRequest } from '../post-inbox-report.request.dto';

/**
 * A report's text arrives as form fields: a field the sender left empty is
 * `''`, not missing. Read as a value, an empty `link` would refuse a report
 * that only has no link.
 */
const parse = (form: Record<string, string>) =>
  new ZodValidationPipe().transform(form, { type: 'body', metatype: PostInboxReportRequest });

describe('PostInboxReportRequest', () => {
  it('reads an empty optional field as absent, and trims the rest', () => {
    expect(parse({ title: '  Checkout is down ', body: '', source: ' ', link: '' })).toEqual({
      title: 'Checkout is down',
    });
  });

  it('keeps a link that is one, and refuses one that is not http(s)', () => {
    expect(parse({ title: 'T', link: 'https://example.com/runs/1' })).toMatchObject({
      link: 'https://example.com/runs/1',
    });
    expect(() => parse({ title: 'T', link: 'javascript:alert(1)' })).toThrow();
  });

  it('still requires a title', () => {
    expect(() => parse({ title: '   ' })).toThrow();
    expect(() => parse({ body: 'no title' })).toThrow();
  });
});
