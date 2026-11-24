import { type BotFormSpec, botFormSpecSchema } from '@oppenheimer/shared';
import { BotFormEntity } from '../domain/bot-form.entity';
import { formSpecProblem } from '../domain/bot-form-values.policy';

/**
 * A form is decided once, and what is sent is read against its fields: a
 * required field filled, a number a number within its bounds, a select one of
 * its options, an address and a day that read as one, and no field the form
 * lacks. What breaks this: a blank required field reaching the bot as if
 * filled, a number sent as words passing as text, a stale form taking a key
 * it never asked, a second submission landing on a decided form.
 */
const SPEC: BotFormSpec = botFormSpecSchema.parse({
  title: 'Release details',
  description: 'What I need to cut the release.',
  fields: [
    { id: 'version', kind: 'text', label: 'Version', required: true, placeholder: 'v2.4.0' },
    { id: 'notes', kind: 'textarea', label: 'Notes' },
    { id: 'replicas', kind: 'number', label: 'Replicas', min: 1, max: 5, default: 2 },
    {
      id: 'channel',
      kind: 'select',
      label: 'Channel',
      options: ['stable', 'beta'],
      required: true,
    },
    { id: 'contact', kind: 'email', label: 'Contact' },
    { id: 'ship_on', kind: 'date', label: 'Ship on' },
  ],
});

const ask = (spec: BotFormSpec = SPEC) =>
  BotFormEntity.ask({ organizationId: 'org-1', botId: 'bot-1', turnId: 'turn-1', spec });
const NOW = new Date('2026-11-24T10:00:00Z');

describe('BotFormEntity', () => {
  it('stores a value per field: words trimmed, numbers read from words, blanks as null', () => {
    const form = ask();
    form.submit('owner-1', NOW, {
      version: '  v2.4.0 ',
      replicas: '3',
      channel: 'beta',
      contact: '',
      ship_on: '2026-12-01',
    });
    expect(form).toMatchObject({ status: 'submitted', decidedByUserId: 'owner-1', decidedAt: NOW });
    expect(form.values).toEqual({
      version: 'v2.4.0',
      notes: null,
      replicas: 3,
      channel: 'beta',
      contact: null,
      ship_on: '2026-12-01',
    });
  });

  it.each([
    [{ channel: 'stable' }, '"Version" is required'],
    [{ version: '   ', channel: 'stable' }, '"Version" is required'],
    [{ version: 'v1', channel: 'nightly' }, '"Channel" takes one of its options'],
    [{ version: 'v1', channel: 'beta', replicas: 9 }, '"Replicas" is at most 5'],
    [{ version: 'v1', channel: 'beta', replicas: 0 }, '"Replicas" is at least 1'],
    [{ version: 'v1', channel: 'beta', replicas: 'three' }, '"Replicas" takes a number'],
    [{ version: 'v1', channel: 'beta', contact: 'not an address' }, '"Contact" takes an address'],
    [{ version: 'v1', channel: 'beta', ship_on: '2026-02-31' }, '"Ship on" takes a day'],
    [{ version: 42, channel: 'beta' }, '"Version" takes words'],
    [{ version: 'v1', channel: 'beta', extra: 'x' }, 'The form has no field "extra"'],
  ])('names what does not fit %j', (values, problem) => {
    const form = ask();
    expect(form.valuesProblem(values)).toBe(problem);
    expect(() => form.submit('owner-1', NOW, values)).toThrow(problem);
    expect(form.status).toBe('pending');
  });

  it('is decided once: a dismissed or retired form takes no submission', () => {
    const dismissed = ask();
    dismissed.dismiss('owner-1', NOW, '  not now  ');
    expect(dismissed).toMatchObject({ status: 'dismissed', note: 'not now', values: null });
    expect(() => dismissed.submit('owner-1', NOW, { version: 'v1', channel: 'beta' })).toThrow(
      'already dismissed',
    );
    const expired = ask();
    expired.expire(NOW);
    expect(expired).toMatchObject({ status: 'expired', decidedByUserId: null });
    expect(() => expired.dismiss('owner-1', NOW)).toThrow('already expired');
  });

  it('refuses a form that does not hold together: shared ids, bounds reversed, a default it does not take', () => {
    const field = (extra: object) => botFormSpecSchema.parse({ title: 'T', fields: [extra] });
    expect(
      formSpecProblem(
        botFormSpecSchema.parse({
          title: 'T',
          fields: [
            { id: 'a', kind: 'text', label: 'A' },
            { id: 'a', kind: 'email', label: 'B' },
          ],
        }),
      ),
    ).toBe('Two fields share the id "a"');
    expect(formSpecProblem(field({ id: 'n', kind: 'number', label: 'N', min: 5, max: 1 }))).toBe(
      '"N" has a min above its max',
    );
    expect(
      formSpecProblem(
        field({ id: 's', kind: 'select', label: 'S', options: ['x', 'y'], default: 'z' }),
      ),
    ).toBe('"S" default does not fit');
    expect(() =>
      ask(field({ id: 'n', kind: 'number', label: 'N', min: 1, max: 3, default: 7 })),
    ).toThrow('"N" default does not fit');
  });
});
