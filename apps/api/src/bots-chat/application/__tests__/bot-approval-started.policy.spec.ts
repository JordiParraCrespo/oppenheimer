import type { BotEngineTool } from '@oppenheimer/backend-agents';
import { None, Some } from 'oxide.ts';
import type { BotApprovalRepositoryPort } from '../../database/bot-approval.repository.port';
import type { BotApprovalEntity } from '../../domain/bot-approval.entity';
import {
  APPROVAL_STARTED_MAX_STEPS,
  APPROVAL_STARTED_REFUSAL,
  BotApprovalStartedPolicy,
} from '../bot-approval-started.policy';

/**
 * The one place that shapes the turn a yes opens: any other turn comes back
 * as it is; that one keeps its tools but each refuses, gets two round trips
 * and takes no steer, and has nothing to say once its call ran, whichever of
 * it and the report the queue ran first.
 */
const archive: BotEngineTool = {
  name: 'archive_mail',
  description: 'Archive.',
  inputSchema: { type: 'object' },
  run: async () => ({ content: 'Archived 25 threads.' }),
};
const request = { tools: [archive], maxSteps: 20 };
const signal = new AbortController().signal;

function opening(stage?: 'started' | 'finished') {
  return {
    role: 'event',
    event: {
      kind: 'approval' as const,
      outcome: 'approved' as const,
      tool: 'archive_mail',
      summary: 'Archive 25 threads',
      sessionId: null,
      approvalId: 'a-1',
      ...(stage && { stage }),
    },
  };
}

function setup(approval: 'running' | 'ran' | 'gone' = 'running') {
  const approvals = {
    findForRun: vi.fn(async () =>
      approval === 'gone' ? None : Some({ running: approval === 'running' } as BotApprovalEntity),
    ),
  } satisfies Pick<BotApprovalRepositoryPort, 'findForRun'>;
  const policy = new BotApprovalStartedPolicy(approvals as unknown as BotApprovalRepositoryPort);
  return { policy, approvals };
}

describe('BotApprovalStartedPolicy', () => {
  it('leaves every other turn as it was read, steers and all, without reading an approval', async () => {
    const { policy, approvals } = setup();
    for (const other of [null, { role: 'user' }, opening('finished'), opening()]) {
      await expect(policy.shape(other, request)).resolves.toEqual({ request, takesSteers: true });
    }
    expect(approvals.findForRun).not.toHaveBeenCalled();
  });

  // What breaks this: the "on it" turn acting before the call it approved
  // reports (archiving twice), taking a message it can never act on, or,
  // offered no tools at all, losing the provider's cache of the conversation.
  it('keeps the turn a yes opens to words while its call runs', async () => {
    const shape = await setup().policy.shape(opening('started'), request);
    expect(shape?.takesSteers).toBe(false);
    expect(shape?.request.maxSteps).toBe(APPROVAL_STARTED_MAX_STEPS);
    expect(shape?.request.tools.map((tool) => tool.name)).toEqual(['archive_mail']);
    await expect(shape?.request.tools[0]?.run({}, { signal })).resolves.toEqual({
      content: APPROVAL_STARTED_REFUSAL,
      isError: true,
    });
  });

  // Regression: "On it" written after the call ran, or under its report.
  it('has nothing to say once the call ran, and still speaks when the card is gone', async () => {
    const { policy, approvals } = setup('ran');
    await expect(policy.shape(opening('started'), request)).resolves.toBeNull();
    expect(approvals.findForRun).toHaveBeenCalledWith('a-1');
    await expect(setup('gone').policy.shape(opening('started'), request)).resolves.toMatchObject({
      takesSteers: false,
    });
  });
});
