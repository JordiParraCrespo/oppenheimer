import {
  Button,
  cn,
  EmptyState,
  FloatingChip,
  Terminal,
  TerminalStatusBar,
  TerminalStatusItem,
} from '@oppenheimer/design-system-web';
import { ArrowDown } from '@oppenheimer/design-system-web/icons';
import { useSharedSessionStream } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { ChatCover } from '../components/chat-cover';
import { TerminalColumn } from '../components/terminal-column';
import { useChatReading } from '../hooks/use-session-chat';
import { useTerminal } from '../hooks/use-terminal';
import type { PaneReading } from '../lib/chat-blocks';

/**
 * A session's terminal as a guest sees it: the same grid and socket as a
 * member's, with each ticket minted through the share. A `read` share's grid
 * takes no input. No host banner and no files: the host is not the guest's,
 * and nothing they drop would be theirs to send. The status line says the
 * link's state, once it is not live, and nothing else: who shared it is
 * the page's bar. `onEnd` is told when
 * the relay closes the terminal, so the page can ask what the share is now.
 *
 * **Chat** (0.7): as `SessionTerminal`, the pane hands in its `reading`;
 * this stream feeds the chat and lends it its input, and once the transcript
 * arrives the page's bar offers Terminal / Chat and Chat draws the pane's
 * `cover` over the grid. The relay sends the transcript only when the sharer
 * has `session_chat_view`.
 */
export function SharedSessionTerminal({
  slug,
  readOnly,
  onEnd,
  reading,
}: {
  slug: string;
  /** The chat this terminal feeds, and how the pane around it reads it. */
  reading: PaneReading;
  readOnly: boolean;
  onEnd: () => void;
}) {
  const { t } = useTranslation();
  const createStream = useSharedSessionStream(slug);
  const { chat, cover } = reading;
  const { shown: chatShown } = useChatReading(reading);
  const { containerRef, closeHistory, status, hasOutput, ended, retryNow } = useTerminal(
    createStream,
    {
      chat,
      agentWindow: true,
      readOnly,
      onEnd,
    },
  );

  return (
    <Terminal className={cn('min-h-0 flex-1 overflow-hidden', chatShown && 'bg-transparent')}>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <TerminalColumn className="h-full py-4">
          <div ref={containerRef} className="isolate size-full" />
        </TerminalColumn>
        {status === 'live' && !hasOutput ? (
          <div className="absolute inset-0 flex items-center justify-center bg-term-bg">
            <EmptyState>
              <EmptyState.Header>
                <EmptyState.Title>{t('sessions.session.starting.title')}</EmptyState.Title>
              </EmptyState.Header>
            </EmptyState>
          </div>
        ) : null}
        {closeHistory && !chatShown ? (
          // A watcher scrolled back through the pane's scrollback: the live
          // grid is one press away.
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center pb-3 font-sans">
            <FloatingChip className="pointer-events-auto" onClick={closeHistory}>
              <ArrowDown />
              {t('sessions.shared.backToLive')}
            </FloatingChip>
          </div>
        ) : null}
        {chatShown ? <ChatCover>{cover}</ChatCover> : null}
      </div>

      {ended ? (
        <div className="px-5 pb-3">
          <ErrorAlert
            message={t(`sessions.shared.ended.${ended}`)}
            action={
              <Button variant="ghost" size="sm" onClick={retryNow}>
                {t('sessions.session.retry')}
              </Button>
            }
          />
        </div>
      ) : null}

      {/* Live, the bar above says it all, as over a member's terminal; the
          line comes back to say the link is connecting, away or closed. */}
      {status === 'live' ? null : (
        <TerminalStatusBar data-phase={status}>
          <TerminalStatusItem>{t(`sessions.shared.status.${status}`)}</TerminalStatusItem>
        </TerminalStatusBar>
      )}
    </Terminal>
  );
}
