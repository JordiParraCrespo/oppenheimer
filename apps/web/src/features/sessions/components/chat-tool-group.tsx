import { ToolCallGroup, ToolCallLive } from '@oppenheimer/design-system-web';
import type { ChatToolCall } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';
import { formatChatElapsed, groupKindOf, sharedKindOf, summaryOf } from '../lib/chat-blocks';
import { CHAT_TOOL_ICONS } from '../lib/chat-icons';
import { ChatToolRow } from './chat-tool-row';
import { ChatToolTarget } from './chat-tool-target';
import { ElapsedClock } from './elapsed-clock';

/**
 * A run of calls the agent made one after another. Settled, it folds into
 * one line that counts them by verb under the glyph they share, the failures
 * in red; while the agent is still in it, the calls are drawn open, and the
 * one in flight says what it is doing now, in the present tense, with its
 * clock running.
 */
export function ChatToolGroup({ calls, live }: { calls: ChatToolCall[]; live: boolean }) {
  const { t } = useTranslation();
  const running = live ? [...calls].reverse().find((call) => call.status === 'running') : undefined;
  const done = calls.filter((call) => call !== running);
  const failed = calls.filter((call) => call.status === 'failed').length;
  const Icon = CHAT_TOOL_ICONS[sharedKindOf(calls)];
  const runningKind = running ? groupKindOf(running.kind) : 'other';
  const [only] = done;

  return (
    <div className="flex flex-col gap-1">
      {done.length === 1 && only ? (
        <ChatToolRow call={only} />
      ) : done.length > 1 ? (
        <ToolCallGroup
          icon={<Icon />}
          summary={summaryOf(done, t)}
          failed={failed > 0 ? t('sessions.chat.failed', { count: failed }) : undefined}
          defaultOpen={live}
        >
          {done.map((call) => (
            <ChatToolRow key={call.id} call={call} />
          ))}
        </ToolCallGroup>
      ) : null}
      {running ? (
        <ToolCallLive
          verb={t(`sessions.chat.verbLive.${runningKind}`)}
          target={<ChatToolTarget call={running} />}
          elapsed={
            running.startedAt ? (
              <ElapsedClock since={running.startedAt} ticking format={formatChatElapsed} />
            ) : undefined
          }
        />
      ) : null}
    </div>
  );
}
