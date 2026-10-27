import { BotApprovalMapper } from '../bot-approval.mapper';
import { BotApprovalEntity } from '../domain/bot-approval.entity';

/**
 * The workspace read's card is the per-bot card plus whose it is: the Inbox
 * names the bot and finds the session's project from `sessionId`, and every
 * field the per-bot card has is still there.
 */
describe('BotApprovalMapper.toWorkspaceResponse', () => {
  it('adds the bot, its name and the session to the card', () => {
    const approval = BotApprovalEntity.request({
      organizationId: 'org-1',
      botId: 'bot-1',
      turnId: 'turn-1',
      tool: 'start_session',
      input: { task: 'Fix it' },
      summary: 'Start Claude Code',
    });
    approval.approve('user-1', new Date('2026-10-26T10:00:00Z'));
    approval.recordResult('Started', false, 'session-1');
    const mapper = new BotApprovalMapper();

    expect(mapper.toWorkspaceResponse(approval, 'Ops')).toEqual({
      ...mapper.toResponse(approval),
      botId: 'bot-1',
      botName: 'Ops',
      sessionId: 'session-1',
    });
  });
});
