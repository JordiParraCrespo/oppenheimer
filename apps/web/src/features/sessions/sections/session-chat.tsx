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
import { TerminalColumn } from '../components/terminal-column';
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
 * Grows the chat above what the reader is on without moving it: the update
 * is drawn at once, so the turns it adds can be measured, and the column
 * keeps its distance from the end.
 */
function keepingPlace(box: HTMLElement | null, grow: () => void): void {
  const fromEnd = box ? box.scrollHeight - box.scrollTop : 0;
  flushSync(grow);
  if (box) box.scrollTop = box.scrollHeight - fromEnd;
}

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
 * click away above them, opened without moving what the reader is on; while
 * the reader is up in it, new turns add below and never take one off the top.
 * It scrolls the whole pane, its scrollbar at the pane's edge, and its turns
 * and composer stand in the terminal grid's `TerminalColumn`, so Terminal /
 * Chat moves neither edge of the text.
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
  // The first turn drawn. At the latest it follows the end; away from it,
  // it is held, so a turn arriving never takes one off the top of what the
  // reader is on. Back at the latest, it follows again.
  const following = Math.max(0, state.turns.length - TURNS_SHOWN);
  const [held, setHeld] = useState<number | null>(null);
  const [wasAtLatest, setWasAtLatest] = useState(atLatest);
  if (wasAtLatest !== atLatest) {
    setWasAtLatest(atLatest);
    setHeld(atLatest ? null : (held ?? following));
  }
  const first = Math.min(held ?? following, state.turns.length);
  const last = state.turns.at(-1);
  const turns = first > 0 ? state.turns.slice(first) : state.turns;

  const showEarlier = () =>
    keepingPlace(scroller.current, () => setHeld(Math.max(0, first - TURNS_SHOWN)));

  return (
    <div className="relative flex size-full flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto pt-6 pb-4">
          <TerminalColumn ref={content} className="flex min-h-full flex-col">
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
              <ChatTranscript className="max-w-none">
                {first > 0 ? (
                  <Button variant="ghost" size="sm" className="self-center" onClick={showEarlier}>
                    <ChevronUp />
                    {t('sessions.chat.earlier', { count: Math.min(first, TURNS_SHOWN) })}
                  </Button>
                ) : null}
                {turns.map((turn) => (
                  <ChatTurn key={turn.id} turn={turn} latest={turn === last} />
                ))}
              </ChatTranscript>
            )}
          </TerminalColumn>
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
        <TerminalColumn className="pb-3">
          {attach ? (
            <SessionChatAttachingSend chat={chat} attach={attach} onSent={toLatest} />
          ) : (
            <SessionChatSend chat={chat} onSent={toLatest} />
          )}
        </TerminalColumn>
      )}
    </div>
  );
}
