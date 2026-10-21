import { DiffStat, ToolCallRow } from '@oppenheimer/design-system-web';
import {
  Bot,
  FilePen,
  FilePlus,
  FileText,
  Globe,
  ListChecks,
  type LucideIcon,
  MessageCircleQuestion,
  Plug,
  Search,
  SquareTerminal,
  Wrench,
} from '@oppenheimer/design-system-web/icons';
import type { ChatToolCall, ChatToolKind } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';

const ICONS: Record<ChatToolKind, LucideIcon> = {
  command: SquareTerminal,
  read: FileText,
  edit: FilePen,
  write: FilePlus,
  search: Search,
  web: Globe,
  todo: ListChecks,
  agent: Bot,
  plan: ListChecks,
  question: MessageCircleQuestion,
  mcp: Plug,
  other: Wrench,
};

/**
 * One call the agent made: its glyph and verb, what it acted on in mono, and
 * how it ended — the lines an edit changed, or a failure in red. A call that
 * returned something folds over its output on the terminal ground.
 */
export function ChatToolRow({ call }: { call: ChatToolCall }) {
  const { t } = useTranslation();
  const Icon = ICONS[call.kind];
  const verb =
    call.kind === 'mcp' || call.kind === 'other'
      ? call.name.replace(/^mcp__/, '').replaceAll('__', ' · ')
      : t(`sessions.chat.verb.${call.kind}`);
  const meta =
    call.status === 'failed' ? (
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
    <ToolCallRow
      icon={<Icon />}
      verb={verb}
      target={call.target ?? call.description ?? undefined}
      meta={meta}
      tone={call.status === 'failed' ? 'danger' : 'default'}
      output={output}
    />
  );
}
