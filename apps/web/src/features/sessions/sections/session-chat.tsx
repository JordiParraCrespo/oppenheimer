import {
  AgentMark,
  Button,
  ChatTranscript,
  EmptyState,
  FloatingChip,
  useStickToBottom,
} from '@oppenheimer/design-system-web';
import { ArrowDown, ChevronUp } from '@oppenheimer/design-system-web/icons';
import type { SessionChat as Chat } from '@oppenheimer/frontend-consumer';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChatTurn } from '../components/chat-turn';
import { useChatState } from '../hooks/use-session-chat';
import type { ChatAttach } from '../lib/chat-blocks';
import { SessionChatAttachingSend } from './session-chat-attaching-send';
import { SessionChatSend } from './session-chat-send';

/**
 * How many turns the chat draws, and how many more each "Show earlier"
 * adds: a session that has run all day keeps hundreds, and drawing every
 * one makes each line the agent writes cost the whole conversation's layout.
 */
const TURNS_SHOWN = 40;

/**
 * A Claude Code session read as a chat (0.7): the conversation off the
 * agent's own transcript, turn by turn, kept at its newest turn while the
 * reader is there. The composer types through the chat into the session's
 * PTY (`SessionChat.send`, `.interrupt`), so the chat never drives the agent
 * any way the terminal could not. It can be spoken as well as typed: the
 * workspace's dictation, spelling the files the agent touched as written.
 * With `attach` (a member's own session), a message carries files too: they
 * go to the host and into the agent's prompt ahead of its words. A long
 * conversation draws its latest turns (`TURNS_SHOWN`), the earlier ones a
 * click away above them, opened without moving what the reader is on.
 */
export function SessionChat({
  chat,
  readOnly,
  attach,
}: {
  chat: Chat;
  readOnly: boolean;
  attach?: ChatAttach;
}) {
  const { t } = useTranslation();
  const state = useChatState(chat);
  const { scroller, content, atLatest, toLatest } = useStickToBottom();
  const [shown, setShown] = useState(TURNS_SHOWN);
  const last = state.turns.at(-1);
  const hidden = Math.max(0, state.turns.length - shown);
  const turns = hidden > 0 ? state.turns.slice(hidden) : state.turns;

  function showEarlier() {
    const box = scroller.current;
    const fromEnd = box ? box.scrollHeight - box.scrollTop : 0;
    // Drawn now, so the turns above can be measured and the reader kept where they were.
    flushSync(() => setShown(shown + TURNS_SHOWN));
    if (box) box.scrollTop = box.scrollHeight - fromEnd;
  }

  return (
    <div className="relative flex size-full flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-5 pt-6 pb-4">
          <div ref={content} className="flex min-h-full flex-col">
            {state.turns.length === 0 ? (
              <EmptyState className="flex-1">
                <EmptyState.Header>
                  <EmptyState.Media>
                    <AgentMark agent="claude-code" className="size-10" />
                  </EmptyState.Media>
                  <EmptyState.Title>{t('sessions.chat.empty.title')}</EmptyState.Title>
                  <EmptyState.Description>
                    {t('sessions.chat.empty.description')}
                  </EmptyState.Description>
                </EmptyState.Header>
              </EmptyState>
            ) : (
              <ChatTranscript>
                {hidden > 0 ? (
                  <Button variant="ghost" size="sm" className="self-center" onClick={showEarlier}>
                    <ChevronUp />
                    {t('sessions.chat.earlier', { count: Math.min(hidden, TURNS_SHOWN) })}
                  </Button>
                ) : null}
                {turns.map((turn) => (
                  <ChatTurn key={turn.id} turn={turn} latest={turn === last} />
                ))}
              </ChatTranscript>
            )}
          </div>
        </div>
        {atLatest ? null : (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-linear-to-t from-chat-ground via-chat-ground/85 to-transparent pt-12 pb-3">
            <FloatingChip className="pointer-events-auto" onClick={toLatest}>
              <ArrowDown />
              {t('sessions.chat.latest')}
            </FloatingChip>
          </div>
        )}
      </div>
      {readOnly ? null : (
        <div className="px-5 pb-3">
          <div className="mx-auto w-full max-w-190">
            {attach ? (
              <SessionChatAttachingSend chat={chat} attach={attach} onSent={toLatest} />
            ) : (
              <SessionChatSend chat={chat} onSent={toLatest} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
