import type { BotRecording } from './bot-chat-replay';

/**
 * A week of a release bot's chat, settled, as `GET /api/v1/bots/:id/conversation`
 * answered it: a turn that read two pull requests and wrote a draft, an
 * approval that started a session, a `delegate` call whose three children
 * ended (one failed), a line from a kind of event this build does not know,
 * and a turn that failed on a refused key. Nothing is running, so the stream
 * only says it is up.
 */
const turn = (id: string, at: string, end: string, extra: Record<string, unknown> = {}) => ({
  id,
  status: 'completed',
  provider: 'anthropic',
  model: 'replay-model',
  error: null,
  failure: null,
  inputTokens: 1800,
  outputTokens: 420,
  contextTokens: null,
  contextWindow: null,
  planLimits: null,
  cancelRequested: false,
  createdAt: at,
  startedAt: at,
  endedAt: end,
  ...extra,
});

const step = (callId: string, name: string, input: object, output: string | null, extra = {}) => ({
  callId,
  name,
  input,
  output,
  isError: false,
  sessionId: null,
  subagents: null,
  allowedBy: null,
  mailDraft: null,
  ...extra,
});

const message = (
  id: string,
  turnId: string | null,
  role: string,
  content: string,
  createdAt: string,
  extra: Record<string, unknown> = {},
) => ({ id, turnId, role, content, steps: [], event: null, attachments: [], createdAt, ...extra });

export const releaseWeek: BotRecording = {
  botId: 'bot-release',
  frames: [
    {
      read: {
        messageCount: 11,
        turns: [
          turn('t1', '2026-10-28T09:00:00.000Z', '2026-10-28T09:00:42.000Z'),
          turn('t2', '2026-10-28T11:00:00.000Z', '2026-10-28T11:00:09.000Z'),
          turn('t3', '2026-10-29T10:00:00.000Z', '2026-10-29T10:01:30.000Z'),
          turn('t4', '2026-10-29T15:00:00.000Z', '2026-10-29T15:00:02.000Z', {
            status: 'failed',
            failure: 'credential',
            error: '401 invalid x-api-key',
            inputTokens: 0,
            outputTokens: 0,
          }),
        ],
        messages: [
          message(
            'm1',
            't1',
            'user',
            'Draft the release notes for 2.4',
            '2026-10-28T09:00:00.000Z',
          ),
          message('m2', 't1', 'activity', '', '2026-10-28T09:00:20.000Z', {
            steps: [
              step('c1', 'read_pull_request', { number: 812 }, 'Add dark mode to Settings'),
              step('c2', 'read_pull_request', { number: 815 }, 'Fix the flaky sign-in test'),
            ],
          }),
          message(
            'm3',
            't1',
            'assistant',
            '## Release 2.4\n\n- Dark mode in Settings\n- A steadier sign-in',
            '2026-10-28T09:00:42.000Z',
          ),
          message(
            'm4',
            't2',
            'event',
            'You approved: Run the release checklist',
            '2026-10-28T11:00:00.000Z',
            {
              event: {
                kind: 'approval',
                outcome: 'approved',
                tool: 'start_session',
                summary: 'Run the release checklist',
                sessionId: 'sess-42',
              },
            },
          ),
          message('m5', 't2', 'activity', '', '2026-10-28T11:00:05.000Z', {
            steps: [
              step('c3', 'start_session', { prompt: 'Run the checklist' }, 'Started sess-42', {
                sessionId: 'sess-42',
              }),
            ],
          }),
          message(
            'm6',
            't2',
            'assistant',
            'The checklist is running in its own session.',
            '2026-10-28T11:00:09.000Z',
          ),
          message(
            'm7',
            't3',
            'user',
            'Check the three open PRs in parallel',
            '2026-10-29T10:00:00.000Z',
          ),
          message('m8', 't3', 'activity', '', '2026-10-29T10:01:20.000Z', {
            steps: [
              step(
                'c4',
                'delegate',
                { tasks: [{ task: 'Check #812' }, { task: 'Check #815' }, { task: 'Check #820' }] },
                '3 subagents ran',
                {
                  subagents: [
                    {
                      task: 'Check #812',
                      status: 'completed',
                      result: 'Green',
                      toolCalls: ['read_pull_request'],
                      inputTokens: 900,
                      outputTokens: 80,
                      durationMs: 12_000,
                    },
                    {
                      task: 'Check #815',
                      status: 'completed',
                      result: 'Green',
                      toolCalls: ['read_pull_request'],
                      inputTokens: 900,
                      outputTokens: 80,
                      durationMs: 9_000,
                    },
                    {
                      task: 'Check #820',
                      status: 'failed',
                      result: 'GitHub refused the read',
                      toolCalls: [],
                      inputTokens: 300,
                      outputTokens: 0,
                      durationMs: 2_000,
                    },
                  ],
                },
              ),
            ],
          }),
          message(
            'm9',
            't3',
            'assistant',
            'Two are green; #820 could not be read.',
            '2026-10-29T10:01:30.000Z',
          ),
          message(
            'm10',
            null,
            'event',
            'Calendar: the release review moved to 16:00\nIt was at 14:00.',
            '2026-10-29T12:00:00.000Z',
            { event: { kind: 'calendar', calendarId: 'cal-1', change: 'moved' } },
          ),
          message('m11', 't4', 'user', 'Publish them to the blog', '2026-10-29T15:00:00.000Z'),
        ],
      },
    },
    { ready: true },
  ],
};
