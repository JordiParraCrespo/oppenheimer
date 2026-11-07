import { DiffStat, ToolCallRow } from '@oppenheimer/design-system-web';
import type { ChatToolCall } from '@oppenheimer/frontend-consumer';
import { ChatToolOutput } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { commandPurposeOf, firstLine, groupKindOf } from '../lib/chat-blocks';
import { chatToolIcon } from '../lib/chat-icons';
import { ChatToolTarget } from './chat-tool-target';

/**
 * One call the agent made: its glyph and verb (for a command, what the agent
 * said it was for, as its terminal shows it), what it acted on, and how it
 * ended — the lines an edit changed, or a failure in red with its first line
 * under the row, readable without opening it. A call that returned something
 * folds over its output on the terminal ground, a JSON answer as a tree.
 */
export function ChatToolRow({ call }: { call: ChatToolCall }) {
  const { t } = useTranslation();
  const kind = groupKindOf(call.kind);
  const Icon = chatToolIcon(call.kind);
  // A command that said what it was for leads with those words; the
  // command after them is there to check, not to read, so it goes quiet.
  const purpose = commandPurposeOf(call);
  const verb =
    purpose ?? (kind === 'mcp' || kind === 'other' ? call.label : t(`sessions.chat.verb.${kind}`));
  const failed = call.status === 'failed';
  const excerpt = failed ? firstLine(call.output) : null;
  const meta = failed ? (
    t('sessions.chat.failedCall')
  ) : call.diff ? (
    <DiffStat additions={call.diff.additions} deletions={call.diff.deletions} />
  ) : undefined;
  const output = !call.output ? undefined : (
    <ChatToolOutput
      text={call.truncated ? `${call.output}\n… ${t('sessions.chat.truncated')}` : call.output}
    />
  );
  return (
    <div className="flex flex-col">
      <ToolCallRow
        icon={<Icon />}
        verb={verb}
        target={
          purpose && call.target ? (
            <span title={call.target} className="text-fg-subtle">
              {call.target}
            </span>
          ) : (
            <ChatToolTarget call={call} />
          )
        }
        meta={meta}
        tone={failed ? 'danger' : 'default'}
        output={output}
      />
      {excerpt ? (
        <p className="m-0 truncate pl-7.75 font-mono text-[12px] text-danger">{excerpt}</p>
      ) : null}
    </div>
  );
}
