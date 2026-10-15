import { emptyScope } from '@oppenheimer/backend-authz';
import { z } from 'zod/v4';
import type { BotApprovalRequesterPort } from '../bot-approval-requester.port';
import { type BotToolContext, defineBotTool } from '../bot-tool.factory';

/**
 * How an asking tool asks (`25-bots.md` §5): under Approve for me its call is
 * checked, then becomes a Needs input card and never runs; the model is told
 * to end its turn, or to wait when a card is already up. Full access runs it,
 * and so does a context carrying out the owner's yes to exactly this call.
 */
function setup(options: { waiting?: boolean; summarize?: () => string } = {}) {
  const run = vi.fn(async (input: { task: string; host?: string }) => `Started ${input.task}`);
  const tool = defineBotTool({
    name: 'start_thing',
    asks: true,
    description: 'Starts a thing.',
    input: z.object({ task: z.string().min(1), host: z.string().optional() }),
    summarize: options.summarize ?? ((input) => `Start ${input.task}`),
    run,
  });
  const approvals = {
    request: vi.fn<BotApprovalRequesterPort['request']>(async () =>
      options.waiting
        ? { status: 'waiting', summary: 'Stop the old thing' }
        : { status: 'requested', approvalId: 'approval-1' },
    ),
  };
  const context = (extra: Partial<BotToolContext> = {}): BotToolContext => ({
    owner: emptyScope('owner-1', 'org-1'),
    organizationId: 'org-1',
    botId: 'bot-1',
    turnId: 'turn-1',
    homeHostId: null,
    timeZone: 'UTC',
    permission: 'auto',
    approvals,
    ...extra,
  });
  const call = (input: unknown, extra?: Partial<BotToolContext>) =>
    tool.bind(context(extra)).run(input, { signal: new AbortController().signal });
  return { run, approvals, call };
}

describe('defineBotTool, an asking tool', () => {
  it('raises a card for a valid call under Approve for me, runs nothing, and tells the model to end its turn', async () => {
    const { run, approvals, call } = setup();
    const result = await call({ task: 'deploy', host: 'b2' });
    expect(approvals.request).toHaveBeenCalledWith({
      organizationId: 'org-1',
      botId: 'bot-1',
      turnId: 'turn-1',
      tool: 'start_thing',
      input: { task: 'deploy', host: 'b2' },
      summary: 'Start deploy',
    });
    expect(result.isError).toBeUndefined();
    expect(result.content).toContain('"Start deploy"');
    expect(result.content).toContain('End your turn now');
    expect(run).not.toHaveBeenCalled();
  });

  it('checks the input before asking: a bad call is an error and raises no card', async () => {
    const { approvals, call } = setup();
    const result = await call({ task: '' });
    expect(result).toMatchObject({ isError: true });
    expect(result.content).toContain('Invalid input');
    expect(approvals.request).not.toHaveBeenCalled();
  });

  it('tells the model to wait when a card is already up, naming it, and runs nothing', async () => {
    const { run, call } = setup({ waiting: true });
    const result = await call({ task: 'deploy' });
    expect(result.content).toContain('"Stop the old thing"');
    expect(result.content).toContain('only one can wait at a time');
    expect(run).not.toHaveBeenCalled();
  });

  it('still raises the card when the summary cannot be built, saying what would run', async () => {
    const { approvals, call } = setup({
      summarize: () => {
        throw new Error('host lookup failed');
      },
    });
    await call({ task: 'deploy' });
    expect(approvals.request.mock.calls[0][0].summary).toBe('start_thing {"task":"deploy"}');
  });

  it('runs under Full access without asking', async () => {
    const { run, approvals, call } = setup();
    const result = await call({ task: 'deploy' }, { permission: 'full' });
    expect(result.content).toBe('Started deploy');
    expect(run).toHaveBeenCalledOnce();
    expect(approvals.request).not.toHaveBeenCalled();
  });

  it('runs the approved call, its input stored in any key order, and asks again for any other', async () => {
    const { run, approvals, call } = setup();
    const approved = { tool: 'start_thing', input: { host: 'b2', task: 'deploy' } };
    expect((await call({ task: 'deploy', host: 'b2' }, { approved })).content).toBe(
      'Started deploy',
    );
    await call({ task: 'deploy', host: 'b3' }, { approved });
    await call({ task: 'deploy', host: 'b2' }, { approved: { ...approved, tool: 'other' } });
    expect(run).toHaveBeenCalledOnce();
    expect(approvals.request).toHaveBeenCalledTimes(2);
  });
});
