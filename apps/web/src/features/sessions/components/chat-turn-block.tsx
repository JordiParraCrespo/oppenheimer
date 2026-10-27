import { ChatMarker, ProposedPlanCard, ReasoningRow } from '@oppenheimer/design-system-web';
import {
  Archive,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleStop,
} from '@oppenheimer/design-system-web/icons';
import type { ChatTaskStatus } from '@oppenheimer/frontend-consumer';
import { Markdown } from '@oppenheimer/frontend-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatBlock } from '../lib/chat-blocks';
import { ChatChanges } from './chat-changes';
import { ChatQuestionRecord } from './chat-question-record';
import { ChatReplyText } from './chat-reply-text';
import { ChatToolGroup } from './chat-tool-group';

const TASK_ICONS: Record<ChatTaskStatus, ReactNode> = {
  completed: <CircleCheck />,
  failed: <CircleAlert />,
  killed: <CircleStop />,
  unknown: <CircleDashed />,
};

/**
 * One block of an agent's turn, drawn as what it is: words as markdown, a
 * plan, what it asked and the files changed as cards, thinking as a fold that is open while
 * it is what the agent is doing, calls as a group, a stop, a compaction or a
 * background task that ended as a note. `live` and `last` say whether this is the work in flight.
 */
export function ChatTurnBlock({
  block,
  live,
  last,
}: {
  block: ChatBlock;
  live: boolean;
  last: boolean;
}) {
  const { t } = useTranslation();
  switch (block.kind) {
    case 'reply':
      return <ChatReplyText text={block.text} />;
    case 'plan':
      return (
        <ProposedPlanCard title={t('sessions.chat.plan')} collapsible>
          <Markdown source={block.call.plan ?? ''} />
        </ProposedPlanCard>
      );
    case 'question':
      return <ChatQuestionRecord call={block.call} />;
    case 'changes':
      return <ChatChanges files={block.files} />;
    case 'thinking': {
      // Open while it is what the agent is doing, folded once it moves on.
      const thinking = live && last;
      return (
        <ReasoningRow
          key={thinking ? 'thinking' : 'thought'}
          defaultOpen={thinking}
          label={
            thinking ? (
              <span className="motion-safe:animate-shimmer">{t('sessions.chat.thinking')}</span>
            ) : block.seconds ? (
              t('sessions.chat.thoughtFor', { seconds: block.seconds })
            ) : (
              t('sessions.chat.thought')
            )
          }
        >
          {block.text}
        </ReasoningRow>
      );
    }
    case 'tools':
      return <ChatToolGroup calls={block.calls} live={live && last} />;
    case 'notice':
      return (
        <ChatMarker icon={block.notice === 'compacted' ? <Archive /> : <CircleStop />}>
          {t(`sessions.chat.notice.${block.notice}`)}
        </ChatMarker>
      );
    case 'task':
      return (
        <ChatMarker icon={TASK_ICONS[block.status]}>
          {block.summary ?? t(`sessions.chat.task.${block.status}`)}
        </ChatMarker>
      );
  }
}
