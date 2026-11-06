import type { ChatToolCall } from '@oppenheimer/frontend-consumer';
import { commandPurposeOf, pathParts } from '../lib/chat-blocks';

const FILE_KINDS = new Set(['read', 'edit', 'write']);

/**
 * What a call acted on, as the eye reads it: a file by its name in full ink
 * with its folder after it in subtle ink, so a long path never loses the
 * name to the truncation; a command that said what it was for, in subtle
 * ink after those words; anything else as it came.
 */
export function ChatToolTarget({ call }: { call: ChatToolCall }) {
  const target = call.target ?? call.description;
  if (!target) return null;
  // The command under its purpose, which leads the row: there to check, not to read.
  if (commandPurposeOf(call) && call.target) {
    return (
      <span title={call.target} className="text-fg-subtle">
        {call.target}
      </span>
    );
  }
  if (!FILE_KINDS.has(call.kind) || !call.target) return <span title={target}>{target}</span>;
  const { name, folder } = pathParts(call.target);
  return (
    <span title={call.target}>
      {name}
      {folder ? <span className="ml-1.5 text-fg-subtle">{folder}</span> : null}
    </span>
  );
}
