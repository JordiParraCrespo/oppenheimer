import {
  AgentMark,
  ChatTranscript,
  EmptyState,
  FloatingChip,
  useStickToBottom,
} from '@oppenheimer/design-system-web';
import { ArrowDown } from '@oppenheimer/design-system-web/icons';
import type { SessionChat as Chat } from '@oppenheimer/frontend-consumer';
import { useVoiceDictation } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { ChatTurn } from '../components/chat-turn';
import { SessionChatComposer } from '../components/session-chat-composer';
import { useChatState } from '../hooks/use-session-chat';
import { chatVocabulary, latestModel, latestTodos, modelName } from '../lib/chat-blocks';

/**
 * A Claude Code session read as a chat (0.7): the conversation off the
 * agent's own transcript, turn by turn, kept at its newest turn while the
 * reader is there. The composer types through the chat into the session's
 * PTY (`SessionChat.send`, `.interrupt`), so the chat never drives the agent
 * any way the terminal could not. It can be spoken as well as typed: the
 * workspace's dictation, spelling the files the agent touched as written.
 */
export function SessionChat({ chat, readOnly }: { chat: Chat; readOnly: boolean }) {
  const { t } = useTranslation();
  const state = useChatState(chat);
  const voice = useVoiceDictation(() => chatVocabulary(chat.snapshot().turns));
  const { scroller, content, atLatest, toLatest } = useStickToBottom();
  const last = state.turns.at(-1);

  const submit = (text: string) => {
    chat.send(text);
    toLatest();
  };

  return (
    <div className="relative flex size-full flex-col">
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
              {state.turns.map((turn) => (
                <ChatTurn key={turn.id} turn={turn} latest={turn === last} />
              ))}
            </ChatTranscript>
          )}
        </div>
      </div>
      {atLatest ? null : (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center">
          <FloatingChip className="pointer-events-auto" onClick={toLatest}>
            <ArrowDown />
            {t('sessions.chat.latest')}
          </FloatingChip>
        </div>
      )}
      {readOnly ? null : (
        <div className="px-5 pb-3">
          <div className="mx-auto w-full max-w-190">
            <SessionChatComposer
              busy={last?.working ?? false}
              todos={last ? latestTodos(last) : null}
              model={modelName(latestModel(state.turns))}
              voice={voice}
              onSend={submit}
              onStop={() => chat.interrupt()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
