import { ChatMarker, ProposedPlanCard, ReasoningRow } from '@oppenheimer/design-system-web';
import {
  Archive,
  ArrowRightLeft,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleStop,
} from '@oppenheimer/design-system-web/icons';
import type { ChatTaskStatus } from '@oppenheimer/frontend-consumer';
import { Markdown } from '@oppenheimer/frontend-web';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { type ChatBlock, modelName } from '../lib/chat-blocks';
import { ChatChanges } from './chat-changes';
import { ChatCommandOutput } from './chat-command-output';
import { ChatImages } from './chat-images';
import { ChatQuestionRecord } from './chat-question-record';
import { ChatReplyText } from './chat-reply-text';
import { ChatSharedFileCard } from './chat-shared-file-card';
import { ChatSubagents } from './chat-subagents';
import { ChatToolGroup } from './chat-tool-group';

const TASK_ICONS: Record<ChatTaskStatus, ReactNode> = {
  completed: <CircleCheck />,
  failed: <CircleAlert />,
  killed: <CircleStop />,
  unknown: <CircleDashed />,
};

/**
 * One block of an agent's turn, drawn as what it is: words as markdown, a
 * plan, what it asked and the files changed as cards, the images a call
 * read as tiles that open, what a slash command printed in the terminal's
 * font, thinking as a fold that is open while it is what the agent is
 * doing, calls as a group (the ones that only looked around as an Explored
 * one), the subagents a call started as rows that open to their own work,
 * a stop, a compaction, a move to another model or a background task that
 * ended as a note, each the same small marker.
 * `live` and `last` say whether this is the work in flight.
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
    case 'images':
      return <ChatImages images={block.images} source={block.source} />;
    case 'file':
      return <ChatSharedFileCard file={block.file} />;
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
    case 'explored':
      return <ChatToolGroup calls={block.calls} live={live && last} explored />;
    case 'subagents':
      // A subagent's own work is drawn by this block, one level down.
      return <ChatSubagents calls={block.calls} Block={ChatTurnBlock} />;
    case 'notice':
      return (
        <ChatMarker icon={block.notice === 'compacted' ? <Archive /> : <CircleStop />}>
          {t(`sessions.chat.notice.${block.notice}`)}
        </ChatMarker>
      );
    case 'model':
      return (
        <ChatMarker icon={<ArrowRightLeft />}>
          <Trans
            i18nKey="sessions.chat.notice.model"
            values={{ model: modelName(block.model) }}
            components={{ model: <strong /> }}
          />
        </ChatMarker>
      );
    case 'output':
      return <ChatCommandOutput text={block.text} failed={block.failed} />;
    case 'task':
      return (
        <ChatMarker icon={TASK_ICONS[block.status]}>
          {block.summary ?? t(`sessions.chat.task.${block.status}`)}
        </ChatMarker>
      );
  }
}
