import {
  AgentMark,
  ChatTranscript,
  EmptyState,
  FloatingChip,
} from '@oppenheimer/design-system-web';
import { ArrowDown } from '@oppenheimer/design-system-web/icons';
import type { SessionChat as Chat } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';
import { ChatTurn } from '../components/chat-turn';
import { SessionChatComposer } from '../components/session-chat-composer';
import { useChatFollow } from '../hooks/use-chat-follow';
import { useChatState } from '../hooks/use-session-chat';
import { latestTodos } from '../lib/chat-blocks';

/**
 * A Claude Code session read as a chat (0.7): the conversation off the
 * agent's own transcript, turn by turn, kept at its newest turn while the
 * reader is there. The composer types through the chat into the session's
 * PTY (`SessionChat.send`, `.interrupt`), so the chat never drives the agent
 * any way the terminal could not.
 */
export function SessionChat({ chat, readOnly }: { chat: Chat; readOnly: boolean }) {
  const { t } = useTranslation();
  const state = useChatState(chat);
  const { scrollerRef, contentRef, away, toLatest } = useChatFollow();
  const last = state.turns.at(-1);

  const submit = (text: string) => {
    chat.send(text);
    toLatest();
  };

  return (
    <div className="relative flex size-full flex-col">
      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto px-5 pt-6 pb-4">
        <div ref={contentRef} className="flex min-h-full flex-col">
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
              {state.turns.map((turn) => (
                <ChatTurn key={turn.id} turn={turn} latest={turn === last} />
              ))}
            </ChatTranscript>
          )}
        </div>
      </div>
      {away ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center">
          <FloatingChip className="pointer-events-auto" onClick={toLatest}>
            <ArrowDown />
            {t('sessions.chat.latest')}
          </FloatingChip>
        </div>
      ) : null}
      {readOnly ? null : (
        <div className="mx-auto w-full max-w-190 px-5 pb-4">
          <SessionChatComposer
            busy={last?.working ?? false}
            todos={last ? latestTodos(last) : null}
            onSend={submit}
            onStop={() => chat.interrupt()}
          />
        </div>
      )}
    </div>
  );
}
