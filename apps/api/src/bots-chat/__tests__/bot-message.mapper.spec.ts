import { BOT_SUBAGENT_PROGRESS_TASK_MAX, botStreamEventSchema } from '@oppenheimer/shared';
import { BotMessageMapper, toQueuedSubagentProgress, toSubagentRuns } from '../bot-message.mapper';
import { BotApprovalEntity } from '../domain/bot-approval.entity';
import { stoppedLine } from '../domain/bot-approval.policy';
import { SUBAGENT_TASK_MAX } from '../domain/bot-subagent.policy';

/**
 * The subagent runs a `delegate` step holds, read back from its column or
 * its call's JSON data: what the mapper wrote comes back whole, a field it
 * cannot read gets its default, a run with no task or a status it does not
 * know is dropped, and anything that is not a list reads as none rather
 * than failing the chat's read.
 */
describe('toSubagentRuns', () => {
  it('reads back the runs a step stored, and nothing from anything else', () => {
    const stored = [
      {
        task: 'a',
        status: 'completed',
        result: 'ok',
        toolCalls: ['list_hosts', 3],
        inputTokens: 5,
        outputTokens: -1,
        durationMs: 9.6,
      },
      { task: 'b', status: 'exploded' },
    ];
    const read = [
      {
        task: 'a',
        status: 'completed',
        result: 'ok',
        toolCalls: ['list_hosts'],
        inputTokens: 5,
        outputTokens: 0,
        durationMs: 10,
      },
    ];
    expect(toSubagentRuns(JSON.stringify(stored))).toEqual(read);
    expect(toSubagentRuns(stored)).toEqual(read);
    expect(toSubagentRuns(undefined)).toBeNull();
    expect(toSubagentRuns('{not json')).toBeNull();
  });
});

describe('toQueuedSubagentProgress', () => {
  /** The regression this guards: a cut that added its mark past the limit, so the console dropped every frame of the call. */
  it('cuts a long task to the frame’s limit, mark included, so the frame still parses', () => {
    const task = 'x'.repeat(SUBAGENT_TASK_MAX);
    const run = toQueuedSubagentProgress(task);

    expect(run.task).toHaveLength(BOT_SUBAGENT_PROGRESS_TASK_MAX);
    expect(run.task.endsWith('…')).toBe(true);
    const frame = { type: 'subagents', turnId: 't1', callId: 'c1', runs: [run] };
    expect(botStreamEventSchema.safeParse(frame).success).toBe(true);
  });

  it('keeps a short task whole, waiting, with nothing called', () => {
    expect(toQueuedSubagentProgress('Check acme/api#12')).toEqual({
      task: 'Check acme/api#12',
      state: 'queued',
      toolCalls: [],
      startedAt: null,
      durationMs: null,
    });
  });
});

describe('an approval line through the mapper', () => {
  /** The regression: the read narrowed the card's id away, so a chat that drew the decision early drew it twice. */
  it('keeps the card it decided, and how, from the row back to the response', () => {
    const approval = BotApprovalEntity.request({
      organizationId: 'org-1',
      botId: 'bot-1',
      turnId: 'turn-1',
      tool: 'start_session',
      input: {},
      summary: 'Start it',
    });
    approval.deny('user-1', new Date());
    const mapper = new BotMessageMapper();
    const record = mapper.toPersistence(stoppedLine(approval, 'Ana'));
    record.createdAt = new Date();
    record.updatedAt = record.createdAt;
    // What the jsonb column hands back: a plain object.
    record.event = JSON.parse(JSON.stringify(record.event));
    const read = mapper.toResponse(mapper.toDomain(record));
    expect(read.event).toMatchObject({
      kind: 'approval',
      outcome: 'stopped',
      approvalId: approval.id,
    });
  });
});
