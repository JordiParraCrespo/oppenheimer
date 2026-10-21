import { ToolCallGroup, ToolCallLive } from '@oppenheimer/design-system-web';
import type { ChatToolCall } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';
import { summaryOf } from '../lib/chat-blocks';
import { ChatToolRow } from './chat-tool-row';

/**
 * A run of calls the agent made one after another. Settled, it folds into
 * one line that counts them by verb, the failures in red; while the agent is
 * still in it, the calls are drawn open, with the one in flight breathing
 * under them.
 */
export function ChatToolGroup({ calls, live }: { calls: ChatToolCall[]; live: boolean }) {
  const { t } = useTranslation();
  const running = live ? [...calls].reverse().find((call) => call.status === 'running') : undefined;
  const runningVerb =
    running?.kind === 'mcp' || running?.kind === 'other' ? 'other' : (running?.kind ?? 'other');
  const failed = calls.filter((call) => call.status === 'failed').length;
  if (calls.length === 1 && !running) {
    const [only] = calls;
    return only ? <ChatToolRow call={only} /> : null;
  }
  return (
    <div className="flex flex-col gap-1">
      <ToolCallGroup
        summary={summaryOf(calls, t)}
        failed={failed > 0 ? t('sessions.chat.failed', { count: failed }) : undefined}
        defaultOpen={live}
      >
        {calls
          .filter((call) => call !== running)
          .map((call) => (
            <ChatToolRow key={call.id} call={call} />
          ))}
      </ToolCallGroup>
      {running ? (
        <ToolCallLive
          verb={t(`sessions.chat.verb.${runningVerb}`)}
          target={running.target ?? running.description ?? undefined}
        />
      ) : null}
    </div>
  );
}
