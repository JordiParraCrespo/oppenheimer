import {
  AgentMark,
  ChatTranscript,
  EmptyState,
  FloatingChip,
  useStickToBottom,
} from '@oppenheimer/design-system-web';
import { ArrowDown, LoaderIcon } from '@oppenheimer/design-system-web/icons';
import type { SessionChat as Chat, SessionAgent } from '@oppenheimer/frontend-consumer';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { SessionChatLoading } from '../components/session-chat-loading';
import { TerminalColumn } from '../components/terminal-column';
import { useEarlierOnReach } from '../hooks/use-earlier-on-reach';
import { useChatLoading, useChatOlder, useChatTurnIds } from '../hooks/use-session-chat';
import type { ChatAttach } from '../lib/chat-blocks';
import { SessionChatActivity } from './session-chat-activity';
import { SessionChatAttachingSend } from './session-chat-attaching-send';
import { SessionChatSend } from './session-chat-send';
import { SessionChatTurn } from './session-chat-turn';

/**
 * How many turns the chat draws, and how many more each scroll to its top
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
 * conversation draws its latest turns (`TURNS_SHOWN`), and scrolling to its
 * top shows a spinner there and then the earlier ones above, drawn without
 * moving what the reader is on (`useEarlierOnReach`): those the chat holds,
 * or, past them, a page asked of the host (`SessionChat.loadOlder`); while
 * the reader is up in it, new turns add below and never take one off the top.
 * It scrolls the whole pane, its scrollbar at the pane's edge, and its turns
 * and composer stand in the terminal grid's `TerminalColumn`, so Terminal /
 * Chat moves neither edge of the text. While the agent works, its own word
 * for the moment, off the terminal's spinner, closes the column
 * (`SessionChatActivity`).
 */
export function SessionChat({
  chat,
  agent,
  readOnly,
  attach,
}: {
  chat: Chat;
  /** Whose conversation it is; none where the reader is not told (a guest on a share). */
  agent: SessionAgent | null;
  readOnly: boolean;
  attach?: ChatAttach;
}) {
  const { t } = useTranslation();
  // The ids alone: each turn subscribes to its own record, so a line the
  // agent writes redraws the turn it lands in and not the list.
  const ids = useChatTurnIds(chat);
  const loading = useChatLoading(chat);
  const older = useChatOlder(chat);
  const { scroller, content, atLatest, toLatest } = useStickToBottom();
  // The first turn drawn. At the latest it follows the end; away from it,
  // it is held, so a turn arriving never takes one off the top of what the
  // reader is on. Back at the latest, it follows again. It is held by its
  // id, so a page of older turns put before it moves nothing; by its
  // distance from the end if that page made it a turn of another id.
  const following = Math.max(0, ids.length - TURNS_SHOWN);
  const anchor = (at: number) => ({ id: ids[at] ?? '', fromEnd: ids.length - at });
  const [held, setHeld] = useState<{ id: string; fromEnd: number } | null>(null);
  const [wasAtLatest, setWasAtLatest] = useState(atLatest);
  if (wasAtLatest !== atLatest) {
    setWasAtLatest(atLatest);
    setHeld(atLatest ? null : (held ?? anchor(following)));
  }
  const heldAt = held ? ids.indexOf(held.id) : -1;
  const first = held
    ? heldAt >= 0
      ? heldAt
      : Math.max(0, ids.length - held.fromEnd)
    : Math.min(following, ids.length);
  const shown = first > 0 ? ids.slice(first) : ids;

  // A page asked of the host is drawn as soon as it is there: the reader
  // already waited at the top for it.
  const [askedHost, setAskedHost] = useState(false);
  const earlier = useEarlierOnReach(() => {
    if (first > 0) {
      setAskedHost(false);
      keepingPlace(scroller.current, () => setHeld(anchor(Math.max(0, first - TURNS_SHOWN))));
    } else if (chat.loadOlder()) {
      setAskedHost(true);
    }
  }, askedHost);

  return (
    <div className="relative flex size-full flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* No scroll anchoring: the turns that leave the top as the drawn
            window follows the end would move the reader up, and the follow
            takes any move up as the reader leaving the end. The chat keeps
            its place itself (`keepingPlace`, the held window). */}
        <div
          ref={scroller}
          className="min-h-0 flex-1 overflow-y-auto pt-6 pb-4 [overflow-anchor:none]"
        >
          <TerminalColumn ref={content} className="flex min-h-full flex-col">
            {loading ? (
              // The history is still arriving: the conversation is drawn once
              // it has, at its end, so until then the column says so.
              <SessionChatLoading agent={agent} />
            ) : ids.length === 0 ? (
              <EmptyState className="flex-1">
                <EmptyState.Header>
                  {agent ? (
                    <EmptyState.Media>
                      <AgentMark agent={agent} className="size-10" />
                    </EmptyState.Media>
                  ) : null}
                  <EmptyState.Title>{t('sessions.chat.empty.title')}</EmptyState.Title>
                  <EmptyState.Description>
                    {t('sessions.chat.empty.description')}
                  </EmptyState.Description>
                </EmptyState.Header>
              </EmptyState>
            ) : (
              <ChatTranscript className="max-w-none">
                {first > 0 || older !== 'none' ? (
                  // Keyed by what is left above it and whether a page is
                  // coming, so a spinner still in view once a page is drawn,
                  // or once a reconnect let a page asked for go, is a new
                  // one, seen afresh.
                  <div
                    key={`${first}:${older}`}
                    ref={earlier}
                    role="status"
                    aria-label={t('sessions.chat.earlier')}
                    className="flex justify-center py-2"
                  >
                    <LoaderIcon
                      aria-hidden
                      className="size-4 text-fg-subtle motion-safe:animate-spin"
                    />
                  </div>
                ) : null}
                {shown.map((id) => (
                  <SessionChatTurn key={id} chat={chat} id={id} />
                ))}
                <SessionChatActivity chat={chat} />
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
            <SessionChatAttachingSend chat={chat} agent={agent} attach={attach} onSent={toLatest} />
          ) : (
            <SessionChatSend chat={chat} agent={agent} onSent={toLatest} />
          )}
        </TerminalColumn>
      )}
    </div>
  );
}
