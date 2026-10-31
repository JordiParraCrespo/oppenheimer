import type { BotRecording } from './bot-chat-replay';

/**
 * A turn recorded while it ran: the bot writes its first paragraph, the API
 * stores it as the deltas keep coming, the bot fans three checks out to
 * subagents, waits on a rate limit, writes on, and ends. Each `read` is what
 * `GET …/conversation` answered after the frame before it nudged the chat.
 */
const turn = (status: string, endedAt: string | null) => ({
  id: 't9',
  status,
  provider: 'anthropic',
  model: 'replay-model',
  error: null,
  failure: null,
  inputTokens: status === 'completed' ? 2400 : 0,
  outputTokens: status === 'completed' ? 310 : 0,
  contextTokens: null,
  contextWindow: null,
  planLimits: null,
  cancelRequested: false,
  createdAt: '2026-10-30T09:00:00.000Z',
  startedAt: '2026-10-30T09:00:00.000Z',
  endedAt,
});

const asked = {
  id: 'm1',
  turnId: 't9',
  role: 'user',
  content: 'Summarise last night’s incident',
  steps: [],
  event: null,
  attachments: [],
  createdAt: '2026-10-30T09:00:00.000Z',
};

const firstParagraph = {
  id: 'm2',
  turnId: 't9',
  role: 'assistant',
  content: 'The deploy at 02:10 failed its health check.',
  steps: [],
  event: null,
  attachments: [],
  createdAt: '2026-10-30T09:00:05.000Z',
};

const delegate = (output: string | null) => ({
  id: 'm3',
  turnId: 't9',
  role: 'activity',
  content: '',
  steps: [
    {
      callId: 'c1',
      name: 'delegate',
      input: { tasks: [{ task: 'Read the logs' }, { task: 'Read the alerts' }] },
      output,
      isError: false,
      sessionId: null,
      subagents:
        output === null
          ? null
          : [
              {
                task: 'Read the logs',
                status: 'completed',
                result: 'OOM',
                toolCalls: ['read_logs'],
                inputTokens: 500,
                outputTokens: 40,
                durationMs: 6_000,
              },
              {
                task: 'Read the alerts',
                status: 'completed',
                result: 'Paged at 02:12',
                toolCalls: [],
                inputTokens: 300,
                outputTokens: 20,
                durationMs: 3_000,
              },
            ],
      allowedBy: null,
      mailDraft: null,
    },
  ],
  event: null,
  attachments: [],
  createdAt: '2026-10-30T09:00:06.000Z',
});

const secondParagraph = {
  id: 'm4',
  turnId: 't9',
  role: 'assistant',
  content: 'It ran out of memory, and was rolled back at 02:20.',
  steps: [],
  event: null,
  attachments: [],
  createdAt: '2026-10-30T09:00:30.000Z',
};

export const incidentLive: BotRecording = {
  botId: 'bot-oncall',
  frames: [
    { read: { messageCount: 1, turns: [turn('running', null)], messages: [asked] } },
    { ready: true },
    { mark: 'opened' },
    { bot: { type: 'text', turnId: 't9', text: 'The deploy at 02:10 ' } },
    { bot: { type: 'text', turnId: 't9', text: 'failed its health check.' } },
    { mark: 'writing' },
    // The block ends and is stored; the stream has already moved on.
    {
      read: { messageCount: 2, turns: [turn('running', null)], messages: [asked, firstParagraph] },
    },
    { bot: { type: 'message', turnId: 't9', messageId: 'm2' } },
    { mark: 'stored' },
    {
      read: {
        messageCount: 2,
        turns: [turn('running', null)],
        messages: [asked, firstParagraph, delegate(null)],
      },
    },
    { bot: { type: 'message', turnId: 't9', messageId: 'm3' } },
    {
      bot: {
        type: 'subagents',
        turnId: 't9',
        callId: 'c1',
        runs: [
          {
            task: 'Read the logs',
            state: 'running',
            toolCalls: ['read_logs'],
            startedAt: '2026-10-30T09:00:06.000Z',
            durationMs: null,
          },
          {
            task: 'Read the alerts',
            state: 'queued',
            toolCalls: [],
            startedAt: null,
            durationMs: null,
          },
        ],
      },
    },
    { mark: 'delegating' },
    // A frame from a newer API: the stream drops it, and the chat goes on.
    { bot: { type: 'reaction', turnId: 't9', emoji: 'eyes' } },
    {
      read: {
        messageCount: 2,
        turns: [turn('running', null)],
        messages: [asked, firstParagraph, delegate('2 subagents ran')],
      },
    },
    { bot: { type: 'message', turnId: 't9', messageId: 'm3' } },
    { bot: { type: 'retrying', turnId: 't9', reason: 'rate_limit' } },
    { mark: 'waiting' },
    { bot: { type: 'text', turnId: 't9', text: 'It ran out of memory, ' } },
    { mark: 'resumed' },
    { bot: { type: 'text', turnId: 't9', text: 'and was rolled back at 02:20.' } },
    {
      read: {
        messageCount: 3,
        turns: [turn('completed', '2026-10-30T09:00:31.000Z')],
        messages: [asked, firstParagraph, delegate('2 subagents ran'), secondParagraph],
      },
    },
    { bot: { type: 'turn', turnId: 't9', status: 'completed' } },
  ],
};
