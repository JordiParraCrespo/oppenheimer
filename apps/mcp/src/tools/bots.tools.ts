import { BOT_MESSAGE_MAX } from '@oppenheimer/shared';
import { z } from 'zod';
import type { OppenheimerClient } from '../client';
import { MAX_WAIT_SECONDS } from './sessions.tools';
import { defineTool } from './tool';

interface TurnView {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';
  error: string | null;
}

interface ConversationView {
  messages: { turnId: string | null; role: string; content: string }[];
  turns: TurnView[];
}

interface ApprovalView {
  turnId: string;
  summary: string;
  status: string;
}

/**
 * Poll a bot's turn until it is over, raised an approval only the person can
 * decide, or `seconds` pass. Answers the turn's own replies.
 */
export async function waitForTurn(
  client: OppenheimerClient,
  botId: string,
  turnId: string,
  seconds: number,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  const deadline = Date.now() + seconds * 1_000;
  for (;;) {
    const [conversation, approvals] = await Promise.all([
      client.get<ConversationView>(`/bots/${botId}/conversation`),
      client.get<ApprovalView[]>(`/bots/${botId}/approvals`),
    ]);
    const turn = conversation.turns.find((candidate) => candidate.id === turnId);
    const replies = conversation.messages
      .filter((message) => message.turnId === turnId && message.role === 'assistant')
      .map((message) => message.content)
      .filter((content) => content.trim() !== '');
    const waitingOnApproval = approvals
      .filter((approval) => approval.turnId === turnId && approval.status === 'pending')
      .map((approval) => approval.summary);
    const over = turn ? ['completed', 'failed', 'cancelled'].includes(turn.status) : false;
    if (over || waitingOnApproval.length > 0 || Date.now() + 2_000 > deadline) {
      return {
        status: turn?.status ?? 'queued',
        error: turn?.error ?? null,
        replies,
        waitingOnApproval,
        done: over,
      };
    }
    await sleep(2_000);
  }
}

export const botTools = [
  defineTool({
    name: 'list_bots',
    title: 'List bots',
    description:
      'List the person’s bots (the console’s Employees): each one’s id, name, job description and model. A bot is a worker with its own memory and tools that can start sessions on hosts itself.',
    requiredScopes: ['bots:read'],
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: (_args, { client }) => client.get('/bots'),
  }),

  defineTool({
    name: 'ask_bot',
    title: 'Ask a bot',
    description: `Send a bot a message in its conversation, as the person, and wait up to wait_seconds (max ${MAX_WAIT_SECONDS}) for its answer. Answers its replies; done is false while it is still working, and waitingOnApproval lists tool calls it wants that only the person can approve in the console.`,
    requiredScopes: ['bots:write'],
    inputSchema: z.object({
      bot_id: z.string().uuid().describe('The bot (from list_bots)'),
      message: z.string().trim().min(1).max(BOT_MESSAGE_MAX).describe('What to say'),
      wait_seconds: z.number().int().min(0).max(MAX_WAIT_SECONDS).default(120),
    }),
    handler: async ({ bot_id, message, wait_seconds }, { client }) => {
      const turn = await client.post<TurnView>(`/bots/${bot_id}/messages`, { content: message });
      return { turnId: turn.id, ...(await waitForTurn(client, bot_id, turn.id, wait_seconds)) };
    },
  }),
];
