import { SubagentRunCard } from '@oppenheimer/design-system-web';
import type { ChatToolCall } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';
import { subagentStateOf } from '../lib/chat-subagents';
import { ChatSubagentRow, type SubagentBlock } from './chat-subagent-row';

/**
 * The subagents a run of calls started (Claude Code's `Agent`, Codex's
 * `spawn_agent`, OpenCode's and Grok's `task`), as one card: how many, how
 * many still run and how many failed, then a row for each.
 */
export function ChatSubagents({ calls, Block }: { calls: ChatToolCall[]; Block: SubagentBlock }) {
  const { t } = useTranslation();
  const states = calls.map(subagentStateOf);
  const running = states.filter((state) => state === 'running').length;
  const failed = states.filter((state) => state === 'failed' || state === 'stopped').length;
  const summary = [
    t('sessions.chat.subagents.count', { count: calls.length }),
    running > 0 ? t('sessions.chat.subagents.running', { count: running }) : null,
    failed > 0 ? t('sessions.chat.subagents.failed', { count: failed }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <SubagentRunCard summary={summary} live={running > 0}>
      {calls.map((call) => (
        <ChatSubagentRow key={call.id} call={call} Block={Block} />
      ))}
    </SubagentRunCard>
  );
}
