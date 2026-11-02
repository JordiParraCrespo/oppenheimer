/**
 * `ask_user` (`25-bots.md` §3.2). What breaks this: questions stored as an
 * approval, which a yes would try to run; a second card raised while one
 * waits, of either kind, leaving the person two things to answer; the tool
 * offered on a turn nobody is waiting on.
 */
import { emptyScope } from '@oppenheimer/backend-authz';
import type { BotQuestionRepositoryPort } from '../../database/bot-question.repository.port';
import type { BotQuestionEntity } from '../../domain/bot-question.entity';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import type { BotApprovalRequesterPort } from '../bot-approval-requester.port';
import { BotQuestionToolsFactory } from '../bot-question-tools.factory';
import type { BotToolContext } from '../bot-tool.factory';

const QUESTIONS = {
  questions: [
    {
      header: 'Repo',
      question: 'Which repository?',
      options: [{ label: 'acme/api' }, { label: 'acme/web', description: 'The console' }],
    },
    { question: 'By when?', options: [{ label: 'Today' }, { label: 'This week' }] },
  ],
};

function setup(stored: 'inserted' | { waiting: string } = 'inserted') {
  const questions = {
    insertPending: vi.fn<BotQuestionRepositoryPort['insertPending']>(async () => stored),
  } satisfies Partial<BotQuestionRepositoryPort>;
  const stream: BotStreamPort = { publish: vi.fn(async () => undefined), subscribe: vi.fn() };
  const approvals = { request: vi.fn<BotApprovalRequesterPort['request']>() };
  const factory = new BotQuestionToolsFactory(
    questions as unknown as BotQuestionRepositoryPort,
    stream,
  );
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
  const [askUser] = factory.definitions();
  const call = (input: unknown) =>
    askUser.bind(context).run(input, { signal: new AbortController().signal });
  return { questions, stream, approvals, askUser, call };
}

describe('BotQuestionToolsFactory', () => {
  it('puts the questions on a card of their own, never an approval, and ends the turn', async () => {
    const { questions, stream, approvals, call } = setup();
    const result = await call(QUESTIONS);
    const card = questions.insertPending.mock.calls[0][0] as BotQuestionEntity;
    expect(card).toMatchObject({
      botId: 'bot-1',
      turnId: 'turn-1',
      status: 'pending',
      summary: 'Which repository? (+1 more)',
    });
    expect(card.questions[1]).toEqual({
      header: null,
      question: 'By when?',
      multiSelect: false,
      options: [
        { label: 'Today', description: null },
        { label: 'This week', description: null },
      ],
    });
    expect(approvals.request).not.toHaveBeenCalled();
    expect(stream.publish).toHaveBeenCalledWith('bot-1', {
      type: 'question',
      questionId: card.id,
      status: 'pending',
    });
    expect(JSON.stringify(result)).toContain('2 questions are now on a card');
  });

  it('tells the bot to wait when a card already waits, of either kind, announcing nothing', async () => {
    const { stream, call } = setup({ waiting: 'Start Claude Code on build-02' });
    const result = await call(QUESTIONS);
    expect(JSON.stringify(result)).toContain('Start Claude Code on build-02');
    expect(JSON.stringify(result)).toContain('only one can wait at a time');
    expect(stream.publish).not.toHaveBeenCalled();
  });

  it('is offered only on a turn a person is waiting on, and never asks to be approved', () => {
    const { askUser } = setup();
    expect(askUser.attendedOnly).toBe(true);
    expect(askUser.traits.asks).toBe(false);
  });
});
