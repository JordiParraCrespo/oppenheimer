import { botFormSpecSchema } from '@oppenheimer/shared';
import { BotFormMapper } from '../bot-form.mapper';
import { BotFormEntity } from '../domain/bot-form.entity';

/**
 * What a form stores is what Postgres takes. What breaks this: a NUL byte in
 * a value the person typed, in a dismissal's note, or in a spec the model
 * wrote (echoed from a tool result) reaching `jsonb` or `text`, which refuse
 * it, so the submit answers 500 and the bot's call throws.
 */
describe('BotFormMapper', () => {
  const spec = botFormSpecSchema.parse({
    title: 'Release\u0000 details',
    fields: [{ id: 'version', kind: 'text', label: 'Version\u0000' }],
  });
  const now = new Date('2026-11-24T10:00:00Z');

  it('drops NUL from the spec, the values and the summary', () => {
    const form = BotFormEntity.ask({
      organizationId: 'org-1',
      botId: 'bot-1',
      turnId: 'turn-1',
      spec,
    });
    form.submit('owner-1', now, { version: 'v2\u0000.4' });
    const record = new BotFormMapper().toPersistence(form);
    expect(JSON.stringify([record.spec, record.values, record.summary])).not.toContain('\\u0000');
    expect(record.values).toEqual({ version: 'v2.4' });
  });

  it('drops NUL from a dismissal note', () => {
    const form = BotFormEntity.ask({
      organizationId: 'org-1',
      botId: 'bot-1',
      turnId: 'turn-1',
      spec,
    });
    form.dismiss('owner-1', now, 'not\u0000 now');
    expect(new BotFormMapper().toPersistence(form).note).toBe('not now');
  });
});
