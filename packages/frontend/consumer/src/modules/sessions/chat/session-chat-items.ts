import type {
  ChatItem,
  ChatItemStatus,
  ChatItemTurn,
  ChatTurnStatus,
} from '@oppenheimer/shared/schemas/chat-item';
import { isoOf, toolItem } from '../../chat/chat-items';
import type { ChatStep, ChatToolCall, ChatTurn } from './session-chat';

/**
 * A session's chat (`SessionChat`'s turns, read off Claude Code's
 * transcript) in the one chat item model: each prompt a `user_message`, each
 * step the item it is, each call the item its classification names. Pure;
 * the turns already paired every call with its result.
 */
export function sessionChatItems(turns: readonly ChatTurn[]): ChatItemTurn[] {
  return turns.map((turn) => {
    const items: ChatItem[] = [];
    if (turn.prompt) {
      items.push({
        type: 'user_message',
        id: turn.prompt.id,
        status: 'completed',
        startedAt: isoOf(turn.prompt.at),
        completedAt: isoOf(turn.prompt.at),
        text: turn.prompt.text,
        attachments: turn.prompt.files,
      });
    }
    for (const step of turn.steps) items.push(itemOf(step));
    return {
      id: turn.id,
      status: turnStatus(turn),
      startedAt: isoOf(turn.startedAt),
      completedAt: turn.working ? null : isoOf(turn.lastAt),
      items,
    };
  });
}

function turnStatus(turn: ChatTurn): ChatTurnStatus {
  if (turn.working) return 'in_progress';
  const last = turn.steps.at(-1);
  return last?.kind === 'notice' && last.notice === 'interrupted' ? 'interrupted' : 'completed';
}

const CALL_STATUS: Record<ChatToolCall['status'], ChatItemStatus> = {
  running: 'in_progress',
  done: 'completed',
  failed: 'failed',
};

function itemOf(step: ChatStep): ChatItem {
  const at = isoOf(step.at);
  switch (step.kind) {
    case 'reply':
      return {
        type: 'agent_message',
        id: step.id,
        status: 'completed',
        startedAt: at,
        completedAt: at,
        text: step.text,
      };
    case 'thinking':
      return {
        type: 'reasoning',
        id: step.id,
        status: 'completed',
        startedAt: at,
        completedAt: at,
        text: step.text,
      };
    case 'notice':
      return {
        type: 'event',
        id: step.id,
        status: 'completed',
        startedAt: at,
        completedAt: at,
        event: step.notice,
        text: null,
      };
    case 'task':
      return {
        type: 'event',
        id: step.id,
        status: step.status === 'completed' ? 'completed' : 'failed',
        startedAt: at,
        completedAt: at,
        event: 'task_ended',
        text: step.summary,
      };
    case 'tool': {
      const { call } = step;
      return toolItem(
        call,
        {
          id: call.id,
          tool: call.name,
          status: CALL_STATUS[call.status],
          startedAt: call.startedAt,
          completedAt: call.finishedAt,
          output: call.output,
        },
        {
          diff: call.diff,
          todos: call.todos?.map((todo) => ({ text: todo.content, status: todo.status })),
          plan: call.plan,
          questions: call.questions?.map((question) => question.question),
        },
      );
    }
  }
}
