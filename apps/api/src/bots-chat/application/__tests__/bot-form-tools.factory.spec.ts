/**
 * `ask_form`. What breaks this: a form stored as an approval, which a yes
 * would try to run; a second card raised while one waits, of any kind,
 * leaving the person two things to answer; a form that does not hold
 * together (two fields with one id) put in front of the person; the tool
 * offered on a turn nobody is waiting on.
 */
import { emptyScope } from '@oppenheimer/backend-authz';
import type { BotFormRepositoryPort } from '../../database/bot-form.repository.port';
import type { BotFormEntity } from '../../domain/bot-form.entity';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import type { BotApprovalRequesterPort } from '../bot-approval-requester.port';
import { BotFormToolsFactory } from '../bot-form-tools.factory';
import type { BotToolContext } from '../bot-tool.factory';

const FORM = {
  title: 'Release details',
  fields: [
    { id: 'version', kind: 'text', label: 'Version', required: true, min: 3 },
    { id: 'replicas', kind: 'number', label: 'Replicas', min: 1, max: 5, options: ['x'] },
    { id: 'channel', kind: 'select', label: 'Channel', options: ['stable', 'beta'] },
  ],
  submitLabel: 'Cut it',
};

function setup(stored: 'inserted' | { waiting: string } = 'inserted') {
  const forms = {
    insertPending: vi.fn<BotFormRepositoryPort['insertPending']>(async () => stored),
  } satisfies Partial<BotFormRepositoryPort>;
  const stream: BotStreamPort = { publish: vi.fn(async () => undefined), subscribe: vi.fn() };
  const approvals = { request: vi.fn<BotApprovalRequesterPort['request']>() };
  const factory = new BotFormToolsFactory(forms as unknown as BotFormRepositoryPort, stream);
  const context: BotToolContext = {
    owner: emptyScope('owner-1', 'org-1'),
    organizationId: 'org-1',
    botId: 'bot-1',
    turnId: 'turn-1',
    homeHostId: null,
    timeZone: null,
    permission: 'auto',
    permissions: NO_PERMISSIONS,
    approvals,
    budget: new BotTurnBudget(),
    credentialScopes: null,
  };
  const [askForm] = factory.definitions();
  const call = (input: unknown) =>
    askForm.bind(context).run(input, { signal: new AbortController().signal });
  return { forms, stream, approvals, askForm, call };
}

describe('BotFormToolsFactory', () => {
  it('puts the form on a card of its own, never an approval, each field read by its kind', async () => {
    const { forms, stream, approvals, call } = setup();
    const result = await call(FORM);
    const form = forms.insertPending.mock.calls[0][0] as BotFormEntity;
    expect(form).toMatchObject({ botId: 'bot-1', turnId: 'turn-1', status: 'pending' });
    expect(form.summary).toBe('Release details');
    expect(form.spec.submitLabel).toBe('Cut it');
    // A key its kind has no use for is dropped, not refused.
    expect(form.spec.fields[0]).not.toHaveProperty('min');
    expect(form.spec.fields[1]).toMatchObject({ kind: 'number', min: 1, max: 5 });
    expect(form.spec.fields[1]).not.toHaveProperty('options');
    expect(approvals.request).not.toHaveBeenCalled();
    expect(stream.publish).toHaveBeenCalledWith('bot-1', {
      type: 'form',
      formId: form.id,
      status: 'pending',
    });
    expect(JSON.stringify(result)).toContain('your form (3 fields) is now on a card');
  });

  it('tells the bot to wait when a card already waits, of any kind, announcing nothing', async () => {
    const { stream, call } = setup({ waiting: 'Which repository?' });
    const result = await call(FORM);
    expect(JSON.stringify(result)).toContain('Which repository?');
    expect(JSON.stringify(result)).toContain('only one can wait at a time');
    expect(stream.publish).not.toHaveBeenCalled();
  });

  it('asks nothing of a form that does not hold together, and says what to fix', async () => {
    const { forms, call } = setup();
    const result = await call({
      title: 'Twice',
      fields: [
        { id: 'name', kind: 'text', label: 'Name' },
        { id: 'name', kind: 'email', label: 'Email' },
      ],
    });
    expect(JSON.stringify(result)).toContain('Two fields share the id');
    const noOptions = await call({
      title: 'Pick',
      fields: [{ id: 'c', kind: 'select', label: 'C' }],
    });
    expect(JSON.stringify(noOptions)).toContain('Not asked');
    expect(forms.insertPending).not.toHaveBeenCalled();
  });

  it('is offered only on a turn a person is waiting on, and never asks to be approved', () => {
    const { askForm } = setup();
    expect(askForm.attendedOnly).toBe(true);
    expect(askForm.traits.asks).toBe(false);
  });
});
