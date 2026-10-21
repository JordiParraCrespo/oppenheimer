import { ChatTranscript, EmptyState, FloatingChip } from '@oppenheimer/design-system-web';
import { ArrowDown } from '@oppenheimer/design-system-web/icons';
import type { SessionChat as Chat } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';
import { ChatTurn } from '../components/chat-turn';
import { SessionChatComposer } from '../components/session-chat-composer';
import { useChatFollow } from '../hooks/use-chat-follow';
import { useChatState } from '../hooks/use-session-chat';
import { INTERRUPT, latestTodos, PASTE_END, PASTE_START } from '../lib/chat-blocks';

/** How long the agent's prompt takes the text before Enter submits it. */
const SUBMIT_AFTER_TEXT_MS = 60;

/**
 * A Claude Code session read as a chat (0.7), over the terminal it came
 * from: the conversation off the agent's own transcript, turn by turn, kept
 * at its newest turn while the reader is there. The composer types into the
 * same PTY the grid does — the text, then Enter — and Stop presses Escape, so
 * the chat never drives the agent any way the terminal could not.
 */
export function SessionChat({
  chat,
  send,
  readOnly,
}: {
  chat: Chat;
  send: (data: string) => void;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const state = useChatState(chat);
  const { scrollerRef, contentRef, away, toLatest } = useChatFollow();
  const last = state.turns.at(-1);

  const submit = (text: string) => {
    // A line is typed as it is; several go as one paste, so a newline in
    // them is part of the message rather than Enter.
    send(text.includes('\n') ? `${PASTE_START}${text}${PASTE_END}` : text);
    setTimeout(() => send('\r'), SUBMIT_AFTER_TEXT_MS);
    toLatest();
  };

  return (
    <div className="relative flex size-full flex-col">
      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto px-5 pt-6 pb-4">
        <div ref={contentRef}>
          {state.turns.length === 0 ? (
            <EmptyState>
              <EmptyState.Header>
                <EmptyState.Title>{t('sessions.chat.empty.title')}</EmptyState.Title>
                <EmptyState.Description>
                  {t('sessions.chat.empty.description')}
                </EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          ) : (
            <ChatTranscript>
              {state.turns.map((turn) => (
                <ChatTurn key={turn.id} turn={turn} />
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
            onStop={() => send(INTERRUPT)}
          />
        </div>
      )}
    </div>
  );
}
