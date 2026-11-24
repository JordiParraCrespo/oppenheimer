import { ToolCallTail } from '@oppenheimer/design-system-web';
import { useCommandTail } from '../hooks/use-command-tail';

/**
 * What a command in flight last printed, under its live row, as the agent's
 * terminal shows it (`useCommandTail`): nothing until it has printed a line,
 * and nothing where no terminal is under the chat. Subscribed on its own, so
 * a new line redraws these lines and no turn. When the result lands the row
 * settles and its full output folds under it as for any call.
 */
export function ChatCommandTail({ command }: { command: string | null }) {
  const lines = useCommandTail(command);
  if (!lines || lines.length === 0) return null;
  return <ToolCallTail lines={lines} />;
}
