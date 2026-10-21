import { DiffStat, ToolCallRow } from '@oppenheimer/design-system-web';
import type { ChatToolCall } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';
import { firstLine, groupKindOf } from '../lib/chat-blocks';
import { CHAT_TOOL_ICONS } from '../lib/chat-icons';
import { ChatToolTarget } from './chat-tool-target';

/**
 * One call the agent made: its glyph and verb, what it acted on, and how it
 * ended — the lines an edit changed, or a failure in red with its first line
 * under the row, readable without opening it. A call that returned something
 * folds over its output on the terminal ground.
 */
export function ChatToolRow({ call }: { call: ChatToolCall }) {
  const { t } = useTranslation();
  const kind = groupKindOf(call.kind);
  const Icon = CHAT_TOOL_ICONS[kind];
  const verb =
    kind === 'mcp' || kind === 'other'
      ? call.name.replace(/^mcp__/, '').replaceAll('__', ' · ')
      : t(`sessions.chat.verb.${kind}`);
  const failed = call.status === 'failed';
  const excerpt = failed ? firstLine(call.output) : null;
  const meta = failed ? (
    t('sessions.chat.failedCall')
  ) : call.diff ? (
    <DiffStat additions={call.diff.additions} deletions={call.diff.deletions} />
  ) : undefined;
  const output = call.output ? (
    <>
      {call.output}
      {call.truncated ? `\n… ${t('sessions.chat.truncated')}` : null}
    </>
  ) : undefined;
  return (
    <div className="flex flex-col">
      <ToolCallRow
        icon={<Icon />}
        verb={verb}
        target={<ChatToolTarget call={call} />}
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
