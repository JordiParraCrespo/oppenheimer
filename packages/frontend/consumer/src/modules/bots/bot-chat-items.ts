import type { BotTurnStatus } from '@oppenheimer/shared/schemas/bot';
import type { ChatItem, ChatItemTurn, ChatTurnStatus } from '@oppenheimer/shared/schemas/chat-item';
import { isoOf, toolItem } from '../chat/chat-items';
import { classifyTool, todosOf } from '../chat/chat-tools';
import type {
  BotConversationEntity,
  BotMessageEntity,
  BotToolStep,
  BotTurnEntity,
} from './bot-conversation.entity';

/**
 * A bot's conversation in the one chat item model: each turn with your
 * message, the bot's replies and each tool call it made as the item its
 * classification names, in the order they happened. A line outside any turn
 * (a routine changed, paused or failed) is a turn of its own holding its one
 * event. Pure; the steps a turn stored are already paired with their output.
 */
export function botChatItems(conversation: BotConversationEntity): ChatItemTurn[] {
  const turns = new Map<string, ChatItemTurn>();
  const turnOf = (key: string, turn: BotTurnEntity | undefined): ChatItemTurn => {
    let block = turns.get(key);
    if (!block) {
      block = {
        id: key,
        status: turn ? TURN_STATUS[turn.status] : 'completed',
        startedAt: isoOf(turn?.startedAt),
        completedAt: isoOf(turn?.endedAt),
        items: [],
      };
      turns.set(key, block);
    }
    return block;
  };
  for (const message of conversation.messages) {
    const turn = message.turnId ? conversation.turn(message.turnId) : undefined;
    const block = turnOf(message.turnId ?? message.id, turn);
    block.items.push(...itemsOf(message, turn));
  }
  for (const turn of conversation.turns) turnOf(turn.id, turn);
  return [...turns.values()];
}

const TURN_STATUS: Record<BotTurnStatus, ChatTurnStatus> = {
  queued: 'queued',
  running: 'in_progress',
  completed: 'completed',
  cancelled: 'interrupted',
  failed: 'failed',
};

function itemsOf(message: BotMessageEntity, turn: BotTurnEntity | undefined): ChatItem[] {
  const at = isoOf(message.createdAt);
  const said = { id: message.id, status: 'completed', startedAt: at, completedAt: at } as const;
  switch (message.role) {
    case 'user':
      return [
        {
          type: 'user_message',
          ...said,
          text: message.content,
          attachments: message.attachments.length,
        },
      ];
    case 'assistant':
      return [{ type: 'agent_message', ...said, text: message.content }];
    case 'event':
      return [{ type: 'event', ...said, event: 'notice', text: message.content || null }];
    case 'activity':
      return message.steps.map((step) => callOf(step, message.createdAt, turn));
  }
}

/**
 * A call is under way until its output is in; one with no output in a turn
 * that has ended never finished, and reads as failed rather than running.
 */
function callOf(step: BotToolStep, startedAt: Date, turn: BotTurnEntity | undefined): ChatItem {
  const ended = turn !== undefined && !turn.isActive;
  const status =
    step.output === null
      ? ended
        ? 'failed'
        : 'in_progress'
      : step.isError
        ? 'failed'
        : 'completed';
  return toolItem(
    classifyTool(step.name, step.input, 'bot'),
    {
      id: step.callId,
      tool: step.name,
      status,
      startedAt,
      completedAt: null,
      output: step.output,
    },
    {
      todos: todosOf(step.input.todos),
      tasks: Array.isArray(step.input.tasks) ? step.input.tasks.length : undefined,
    },
  );
}
