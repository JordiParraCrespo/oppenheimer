import { ToolCallGroup, ToolCallLive } from '@oppenheimer/design-system-web';
import type { ChatToolCall } from '@oppenheimer/frontend-consumer';
import { useExploredLine } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { formatChatElapsed, groupKindOf, sharedKindOf, summaryOf } from '../lib/chat-blocks';
import { chatToolIcon } from '../lib/chat-icons';
import { exploredPartsOf } from '../lib/explored';
import { ChatToolRow } from './chat-tool-row';
import { ChatToolTarget } from './chat-tool-target';
import { ElapsedClock } from './elapsed-clock';

/**
 * A run of calls the agent made one after another, folded into one line that
 * counts them by verb under the glyph they share, the failures in red; the
 * line opens to the calls. It stays folded while the agent is still in it,
 * so a long run never pushes its words off screen: the call in flight is the
 * line under it, saying what it is doing now, in the present tense, with its
 * clock running. A run that only looked around (`explored`) says so instead
 * of counting, "Explored" ("Exploring" while it is still at it) with what it
 * read, searched and listed after it, and opens to the same rows.
 */
export function ChatToolGroup({
  calls,
  live,
  explored = false,
}: {
  calls: ChatToolCall[];
  live: boolean;
  explored?: boolean;
}) {
  const { t } = useTranslation();
  const exploredLine = useExploredLine();
  const running = live ? [...calls].reverse().find((call) => call.status === 'running') : undefined;
  const done = calls.filter((call) => call !== running);
  const failed = calls.filter((call) => call.status === 'failed').length;
  const Icon = chatToolIcon(explored ? 'search' : sharedKindOf(calls));
  const runningKind = running ? groupKindOf(running.kind) : 'other';
  const [only] = done;
  // A run still exploring keeps its heading over the one call it has done.
  const grouped = done.length > 1 || (explored && running !== undefined && done.length > 0);

  return (
    <div className="flex flex-col gap-1">
      {!grouped && only ? (
        <ChatToolRow call={only} />
      ) : grouped ? (
        <ToolCallGroup
          icon={<Icon />}
          summary={
            !explored ? (
              summaryOf(done, t)
            ) : running ? (
              <span className="motion-safe:animate-shimmer">{t('sessions.chat.exploring')}</span>
            ) : (
              t('sessions.chat.explored.title')
            )
          }
          detail={explored ? exploredLine(exploredPartsOf(done)) : undefined}
          failed={failed > 0 ? t('sessions.chat.failed', { count: failed }) : undefined}
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
