import type { BotApprovalDecision } from '@oppenheimer/shared';
import { BotApprovalEntity } from '../../domain/bot-approval.entity';
import { BotTurnEntity } from '../../domain/bot-turn.entity';
import { decideApproval } from '../bot-approval-decision.policy';

/**
 * What each decision on a Needs input card owes (`25-bots.md` §5), as one
 * pure step the handler writes: a yes stages the call, and leaves a
 * permission standing only when it reaches past this call; a no queues the
 * turn the bot carries on from; a stop writes its line, queues no turn, and
 * stops the asking turn only while it still runs. The write and its race
 * are the handler's spec and the integration suite's.
 */
const NOW = new Date('2026-10-31T10:00:00Z');
const bot = {
  id: 'bot-1',
  organizationId: 'org-1',
  provider: 'glm' as const,
  model: null,
  effort: null,
};

function setup(asking: 'running' | 'completed' | 'gone' = 'completed') {
  const asked = BotTurnEntity.queue({
    organizationId: 'org-1',
    botId: 'bot-1',
    requestedByUserId: 'user-1',
    provider: 'glm',
    model: 'glm-5.3',
    effort: null,
    timeZone: 'Europe/Madrid',
    credentialScopes: null,
  });
  if (asking !== 'gone') asked.start(NOW);
  if (asking === 'completed') asked.end('completed', NOW);
  const approval = BotApprovalEntity.request({
    organizationId: 'org-1',
    botId: 'bot-1',
    turnId: asked.id,
    tool: 'start_session',
    input: { task: 'Fix it' },
    summary: 'Start Claude Code on build-02',
    subject: { kind: 'project', key: 'p-1', label: 'XRP' },
  });
  const decide = (decision: BotApprovalDecision) =>
    decideApproval(
      approval,
      decision,
      { userId: 'user-1', name: 'Ana', scopes: null, note: 'Not now' },
      { bot, asked: asking === 'gone' ? null : asked, now: NOW },
    );
  return { approval, decide };
}

describe('decideApproval', () => {
  it('stages the call on a yes, standing for nothing past it', () => {
    const { approval, decide } = setup();
    expect(decide('approve')).toEqual({ effects: { runCall: { by: 'Ana' } }, cancelAsking: false });
    expect(approval).toMatchObject({ status: 'approved', reach: 'once' });
  });

  it('leaves the subject’s grant standing with Always allow for …', () => {
    const { decide } = setup();
    const { effects } = decide('approve_for_subject');
    expect(effects.standing?.permission.getProps()).toMatchObject({
      tool: 'start_session',
      subject: { kind: 'project', key: 'p-1', label: 'XRP' },
    });
  });

  it('queues the turn the bot carries on from on a no, and stops nothing', () => {
    const { approval, decide } = setup('running');
    const { effects, cancelAsking } = decide('deny');
    expect(cancelAsking).toBe(false);
    expect(effects.line).toBeUndefined();
    expect(effects.continuation?.turn).toMatchObject({
      status: 'queued',
      timeZone: 'Europe/Madrid',
    });
    expect(effects.continuation?.opening.event).toMatchObject({ outcome: 'denied' });
    expect(approval.status).toBe('denied');
  });

  it('writes a stop’s line, queues no turn, and stops the asking turn while it runs', () => {
    const { decide } = setup('running');
    const { effects, cancelAsking } = decide('stop');
    expect(effects.continuation).toBeUndefined();
    expect(effects.runCall).toBeUndefined();
    expect(effects.line).toMatchObject({ turnId: null, event: { outcome: 'stopped' } });
    expect(cancelAsking).toBe(true);
  });

  it('stops no turn that already ended, or is gone', () => {
    expect(setup('completed').decide('stop').cancelAsking).toBe(false);
    expect(setup('gone').decide('stop').cancelAsking).toBe(false);
  });
});
