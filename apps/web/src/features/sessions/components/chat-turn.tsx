import {
  ChatMarker,
  ChatUserMessage,
  ProposedPlanCard,
  ReasoningRow,
  TurnHeader,
} from '@oppenheimer/design-system-web';
import { Archive, CircleStop, Paperclip } from '@oppenheimer/design-system-web/icons';
import type { ChatTurn as Turn } from '@oppenheimer/frontend-consumer';
import { dateFormatter, Markdown, useLocale } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { blocksOf, elapsedOf, modelName } from '../lib/chat-blocks';
import { ChatReplyText } from './chat-reply-text';
import { ChatToolGroup } from './chat-tool-group';

/**
 * One turn of the chat view: what the person sent, as a card on the right,
 * then the agent's turn under its header (how long it worked, on which
 * model) — its thinking and its calls in muted ink, what it said as
 * markdown, a plan as its own card. The header folds the work away and
 * leaves the words.
 */
export function ChatTurn({ turn }: { turn: Turn }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [open, setOpen] = useState(true);
  const time = dateFormatter(locale, { timeStyle: 'short' });
  const blocks = blocksOf(turn);
  const live = turn.working;

  return (
    <div className="flex flex-col gap-4">
      {turn.prompt ? (
        <ChatUserMessage
          time={turn.prompt.at ? time.format(turn.prompt.at) : undefined}
          attachments={
            turn.prompt.files > 0 ? (
              <ChatMarker icon={<Paperclip />}>
                {t('sessions.chat.files', { count: turn.prompt.files })}
              </ChatMarker>
            ) : undefined
          }
        >
          {turn.prompt.text}
        </ChatUserMessage>
      ) : null}
      {blocks.length > 0 || live ? (
        <TurnHeader
          state={live ? 'working' : 'done'}
          elapsed={elapsedOf(turn) ?? undefined}
          model={modelName(turn.model) ?? undefined}
          time={turn.lastAt ? time.format(turn.lastAt) : undefined}
          open={open}
          onToggle={live ? undefined : () => setOpen(!open)}
          labels={{
            working: t('sessions.chat.turn.working'),
            worked: t('sessions.chat.turn.worked'),
            stopped: t('sessions.chat.turn.stopped'),
            interrupted: t('sessions.chat.turn.interrupted'),
          }}
        />
      ) : null}
      {blocks.map((block, index) => {
        if (block.kind === 'reply') return <ChatReplyText key={block.id} text={block.text} />;
        if (block.kind === 'plan') {
          return (
            <ProposedPlanCard key={block.id} title={t('sessions.chat.plan')} collapsible>
              <Markdown source={block.call.plan ?? ''} />
            </ProposedPlanCard>
          );
        }
        if (!open) return null;
        switch (block.kind) {
          case 'thinking':
            return (
              <ReasoningRow key={block.id} label={t('sessions.chat.thinking')}>
                {block.text}
              </ReasoningRow>
            );
          case 'tools':
            return (
              <ChatToolGroup
                key={block.id}
                calls={block.calls}
                live={live && index === blocks.length - 1}
              />
            );
          case 'notice':
            return (
              <ChatMarker
                key={block.id}
                icon={block.notice === 'compacted' ? <Archive /> : <CircleStop />}
              >
                {t(`sessions.chat.notice.${block.notice}`)}
              </ChatMarker>
            );
          default:
            // The task list is the composer's (`latestTodos`), not the transcript's.
            return null;
        }
      })}
    </div>
  );
}
